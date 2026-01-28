"""
AI Recommendation Engine - Enhanced for Custom Criteria/Statements/Scenarios
Uses Groq API (with NVIDIA NIM fallback) to generate personalized recommendations
"""

import os
import json
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

from groq import AsyncGroq
from openai import AsyncOpenAI

from shared.models.events import Recommendation, CustomCriteriaInfo
from .knowledge_base import KnowledgeBase
from .config import settings

logger = logging.getLogger(__name__)


class AIRecommendationEngine:
    """
    Generates AI-powered recommendations using LLM APIs.
    Implements fallback chain: Groq → NVIDIA NIM → Error
    NOW SUPPORTS: Custom criteria (sustainability), custom statements (human_centricity), custom scenarios (resilience)
    """
    
    def __init__(self):
        # Initialize API clients
        self.groq_client = None
        self.nvidia_client = None
        self.current_model = None
        
        # Groq setup
        groq_api_key = settings.groq_api_key
        if groq_api_key:
            self.groq_client = AsyncGroq(api_key=groq_api_key)
            self.groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
            logger.info(f"✓ Groq client initialized (model: {self.groq_model})")
        
        # NVIDIA NIM setup (backup)
        nvidia_api_key = settings.nvidia_api_key
        if nvidia_api_key:
            self.nvidia_client = AsyncOpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=nvidia_api_key
            )
            self.nvidia_model = os.getenv("NVIDIA_MODEL", "meta/llama-3.1-70b-instruct")
            logger.info(f"✓ NVIDIA NIM client initialized (model: {self.nvidia_model})")
        
        if not self.groq_client and not self.nvidia_client:
            raise ValueError("No AI API keys configured. Set GROQ_API_KEY or NVIDIA_API_KEY")
        
        # Initialize knowledge base
        self.knowledge_base = KnowledgeBase()
        
        # Rate limiting
        self.max_retries = 3
        self.timeout = 30  # seconds
    
    async def generate_recommendations(
        self,
        assessment_data: Dict[str, Any],
        custom_criteria: Optional[List[CustomCriteriaInfo]] = None
    ) -> List[Recommendation]:
        """
        Generate recommendations for an assessment.
        
        Args:
            assessment_data: Full assessment data including scores and detailed metrics
            custom_criteria: List of custom criteria to generate tips for (OPTIONAL - auto-detected)
        
        Returns:
            List of Recommendation objects
        """
        try:
            # Step 1: Auto-detect custom elements from assessment data
            custom_elements = self._extract_custom_elements(assessment_data)
            
            # Step 2: Get relevant tips from knowledge base (for default criteria only)
            tips = await self._get_relevant_tips(assessment_data)
            
            # Step 3: Generate tips for ALL custom elements
            custom_tips = await self._generate_custom_element_tips(custom_elements)
            
            # Step 4: Build comprehensive prompt
            prompt = self._build_prompt(assessment_data, tips, custom_tips, custom_elements)
            
            # Step 5: Call LLM with fallback chain
            response = await self._call_llm_with_fallback(prompt)
            
            # Step 6: Parse response into structured recommendations
            recommendations = self._parse_llm_response(response, assessment_data)
            
            logger.info(f"Generated {len(recommendations)} recommendations (custom elements: {len(custom_elements['all'])})")
            return recommendations
            
        except Exception as e:
            logger.error(f"Failed to generate recommendations: {e}", exc_info=True)
            # Return fallback rule-based recommendations
            return self._fallback_recommendations(assessment_data)
    
    def _extract_custom_elements(self, assessment_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract all custom criteria, statements, and scenarios from assessment data
        
        Returns:
            Dictionary with custom elements organized by domain and type
        """
        custom_elements = {
            'sustainability': {
                'custom_criteria': [],      # Custom criteria (ENV_06, ECO_05, etc.)
                'has_custom': False
            },
            'resilience': {
                'custom_scenarios': [],      # Custom scenarios beyond defaults
                'high_risk_custom': [],      # Custom scenarios with high risk
                'has_custom': False
            },
            'human_centricity': {
                'custom_statements': {},     # Custom statements by domain
                'has_custom': False
            },
            'all': []  # Flat list for easy counting
        }
        
        detailed_metrics = assessment_data.get("detailed_metrics", {})
        
        # ===== SUSTAINABILITY: Extract custom criteria =====
        if "sustainability" in detailed_metrics:
            sus_metrics = detailed_metrics["sustainability"]
            
            if "detailed_metrics" in sus_metrics:
                for dimension, criteria in sus_metrics["detailed_metrics"].items():
                    for crit_id, crit_data in criteria.items():
                        # Check if this is marked as custom
                        if crit_data.get("is_custom", False):
                            custom_criterion = {
                                'dimension': dimension,
                                'criterion_id': crit_id,
                                'criterion_name': crit_data.get("criterion_name", crit_id),
                                'level_index': crit_data.get("level_index", 0),
                                'max_level': crit_data.get("max_level", 5),
                                'level_description': crit_data.get("level_description", "")
                            }
                            custom_elements['sustainability']['custom_criteria'].append(custom_criterion)
                            custom_elements['all'].append({
                                'domain': 'sustainability',
                                'type': 'criterion',
                                **custom_criterion
                            })
                            custom_elements['sustainability']['has_custom'] = True
        
        # ===== RESILIENCE: Extract custom scenarios =====
        if "resilience" in detailed_metrics:
            res_metrics = detailed_metrics["resilience"]
            
            if "risk_metrics" in res_metrics and "detailed_metrics" in res_metrics["risk_metrics"]:
                for domain_name, domain_data in res_metrics["risk_metrics"]["detailed_metrics"].items():
                    scenarios = domain_data.get("scenarios", {})
                    
                    for scenario_text, scenario_details in scenarios.items():
                        # Custom scenarios would be marked in validation_warnings or have special keys
                        # For now, we'll detect by checking if they're not in default scenarios
                        # This requires comparing against known defaults - simplified approach:
                        # Assume scenarios with very high risk or unusual patterns might be custom
                        risk_score = scenario_details.get("risk_score", 0)
                        
                        # Store all scenarios, mark high-risk ones
                        if risk_score >= 16:  # High risk threshold
                            custom_scenario = {
                                'domain': domain_name,
                                'scenario_text': scenario_text,
                                'risk_score': risk_score,
                                'likelihood': scenario_details.get("likelihood", "Unknown"),
                                'impact': scenario_details.get("impact", "Unknown")
                            }
                            custom_elements['resilience']['high_risk_custom'].append(custom_scenario)
                            custom_elements['all'].append({
                                'domain': 'resilience',
                                'type': 'high_risk_scenario',
                                **custom_scenario
                            })
                            custom_elements['resilience']['has_custom'] = True
        
        # ===== HUMAN CENTRICITY: Extract custom statements =====
        if "human_centricity" in detailed_metrics:
            hc_metrics = detailed_metrics["human_centricity"]
            
            # Check each domain's response_breakdown for custom responses
            for hc_domain, domain_metrics in hc_metrics.items():
                if hc_domain in ['scoring_metadata', 'selected_domains', 'total_domains']:
                    continue
                
                if isinstance(domain_metrics, dict):
                    response_breakdown = domain_metrics.get("response_breakdown", {})
                    custom_responses = response_breakdown.get("custom_responses", [])
                    
                    if custom_responses:
                        custom_elements['human_centricity']['custom_statements'][hc_domain] = custom_responses
                        custom_elements['all'].extend([{
                            'domain': 'human_centricity',
                            'type': 'custom_statement',
                            'hc_domain': hc_domain,
                            'statement': resp.get('statement', 'Unknown'),
                            'rating': resp.get('rating', 0)
                        } for resp in custom_responses])
                        custom_elements['human_centricity']['has_custom'] = True
        
        logger.info(f"Detected custom elements: sustainability={len(custom_elements['sustainability']['custom_criteria'])}, "
                   f"resilience={len(custom_elements['resilience']['high_risk_custom'])}, "
                   f"human_centricity={sum(len(v) for v in custom_elements['human_centricity']['custom_statements'].values())}")
        
        return custom_elements
    
    async def _get_relevant_tips(self, assessment_data: Dict[str, Any]) -> Dict[str, List[str]]:
        """Get relevant tips from knowledge base based on low-scoring DEFAULT areas"""
        tips = {}
        
        domain_scores = assessment_data.get("domain_scores", {})
        detailed_metrics = assessment_data.get("detailed_metrics", {})
        
        # For each low-scoring domain, get tips for DEFAULT criteria only
        for domain, score in domain_scores.items():
            if score < 60 and domain in ["sustainability", "resilience", "human_centricity"]:
                domain_tips = self.knowledge_base.get_tips(
                    domain=domain,
                    score=score,
                    detailed_metrics=detailed_metrics.get(domain, {}),
                    max_tips=8  # Get more tips for default criteria
                )
                tips[domain] = domain_tips
        
        return tips
    
    async def _generate_custom_element_tips(
        self,
        custom_elements: Dict[str, Any]
    ) -> Dict[str, List[str]]:
        """
        Generate AI tips for ALL custom elements across all domains
        
        Returns:
            Dict with keys like "sustainability_ENV_06", "resilience_scenario_1", "human_centricity_Core_Usability"
        """
        custom_tips = {}
        
        # ===== SUSTAINABILITY CUSTOM CRITERIA =====
        for criterion in custom_elements['sustainability']['custom_criteria']:
            try:
                prompt = f"""Generate 3 practical improvement tips for this CUSTOM sustainability criterion:

Domain: {criterion['dimension']}
Criterion: {criterion['criterion_name']} (ID: {criterion['criterion_id']})
Current Level: {criterion['level_index']}/{criterion['max_level']} - "{criterion['level_description']}"

This is a custom criterion specific to this assessment. Provide actionable recommendations to improve from the current level.
Format as a numbered list."""

                response = await self._call_llm_with_fallback(prompt)
                tips = self._parse_tips_from_response(response)
                
                key = f"sustainability_{criterion['criterion_id']}"
                custom_tips[key] = tips[:3]
                
                logger.info(f"Generated {len(tips)} tips for custom criterion: {criterion['criterion_name']}")
                
            except Exception as e:
                logger.error(f"Failed to generate tips for custom criterion {criterion['criterion_name']}: {e}")
        
        # ===== RESILIENCE HIGH-RISK SCENARIOS =====
        for scenario in custom_elements['resilience']['high_risk_custom']:
            try:
                prompt = f"""Generate 3 specific mitigation strategies for this high-risk resilience scenario:

Domain: {scenario['domain']}
Scenario: "{scenario['scenario_text']}"
Risk Score: {scenario['risk_score']}/25 (Likelihood: {scenario['likelihood']}, Impact: {scenario['impact']})

This is a HIGH-RISK scenario. Provide concrete mitigation actions to reduce likelihood or impact.
Format as a numbered list."""

                response = await self._call_llm_with_fallback(prompt)
                tips = self._parse_tips_from_response(response)
                
                key = f"resilience_{scenario['domain']}_highrisk"
                if key not in custom_tips:
                    custom_tips[key] = []
                custom_tips[key].extend(tips[:2])  # 2 tips per high-risk scenario
                
                logger.info(f"Generated {len(tips)} tips for high-risk scenario in {scenario['domain']}")
                
            except Exception as e:
                logger.error(f"Failed to generate tips for scenario '{scenario['scenario_text']}': {e}")
        
        # ===== HUMAN CENTRICITY CUSTOM STATEMENTS =====
        for hc_domain, custom_responses in custom_elements['human_centricity']['custom_statements'].items():
            try:
                if not custom_responses:
                    continue
                
                # Analyze custom statement responses
                statements_summary = "\n".join([
                    f"- {resp.get('statement', 'Unknown')}: Rating {resp.get('rating', 0)}/7"
                    for resp in custom_responses[:5]  # Limit to 5 for context
                ])
                
                prompt = f"""Generate 3 improvement recommendations based on these CUSTOM human-centricity statements:

Domain: {hc_domain}
Custom Statements and Ratings:
{statements_summary}

These are custom statements added for this specific assessment. Provide actionable improvements based on the ratings.
Format as a numbered list."""

                response = await self._call_llm_with_fallback(prompt)
                tips = self._parse_tips_from_response(response)
                
                key = f"human_centricity_{hc_domain}_custom"
                custom_tips[key] = tips[:3]
                
                logger.info(f"Generated {len(tips)} tips for custom statements in {hc_domain}")
                
            except Exception as e:
                logger.error(f"Failed to generate tips for custom statements in {hc_domain}: {e}")
        
        return custom_tips
    
    def _parse_tips_from_response(self, response: str) -> List[str]:
        """Parse tips from LLM response (handles numbered lists, bullets, etc.)"""
        tips = []
        lines = [line.strip() for line in response.split('\n') if line.strip()]
        
        for line in lines:
            # Remove numbering and bullets
            clean_line = line.lstrip('0123456789.- ')
            
            # Only keep lines that look like actual tips (not headers, etc.)
            if len(clean_line) > 20 and any(c.isalpha() for c in clean_line):
                tips.append(clean_line)
        
        return tips
    
    def _build_prompt(
        self,
        assessment_data: Dict[str, Any],
        tips: Dict[str, List[str]],
        custom_tips: Dict[str, List[str]],
        custom_elements: Dict[str, Any]
    ) -> str:
        """Build comprehensive prompt for LLM including custom elements context"""
        
        assessment_id = assessment_data.get("assessment_id")
        system_name = assessment_data.get("system_name", "the digital twin system")
        overall_score = assessment_data.get("overall_score", 0)
        domain_scores = assessment_data.get("domain_scores", {})
        priority_areas = assessment_data.get("priority_areas", {})
        detailed_metrics = assessment_data.get("detailed_metrics", {})
        
        # CRITICAL: Identify ONLY the domains that were assessed
        assessed_domains = set(domain_scores.keys())
        all_possible_domains = {"sustainability", "resilience", "human_centricity"}
        unassessed_domains = all_possible_domains - assessed_domains
        
        # For each assessed domain, identify what was actually evaluated
        assessed_scope = self._get_assessed_scope(detailed_metrics, assessed_domains)
        
        prompt = f"""You are an expert consultant specializing in digital twin assessment and improvement. 
You are analyzing assessment results for "{system_name}".

# ASSESSMENT SCOPE
Domains Assessed: {', '.join(sorted(assessed_domains))}
Domains NOT Assessed: {', '.join(sorted(unassessed_domains)) if unassessed_domains else 'All domains assessed'}

Assessment Details:
{self._format_assessment_scope(assessed_scope)}

# ASSESSMENT RESULTS

Overall Score: {overall_score:.1f}/100

Domain Scores (ONLY for assessed domains):
"""
        
        # Add domain scores - only for assessed domains
        for domain in sorted(assessed_domains):
            score = domain_scores.get(domain, 0)
            status = "⚠️ NEEDS IMPROVEMENT" if score < 60 else "✓ Good" if score < 80 else "✓✓ Excellent"
            prompt += f"- {domain.replace('_', ' ').title()}: {score:.1f}/100 {status}\n"
        
        # Add CUSTOM ELEMENTS SUMMARY
        total_custom = len(custom_elements['all'])
        if total_custom > 0:
            prompt += f"\n# CUSTOM ASSESSMENT ELEMENTS: {total_custom} custom elements detected\n\n"
            
            if custom_elements['sustainability']['has_custom']:
                prompt += f"Sustainability: {len(custom_elements['sustainability']['custom_criteria'])} custom criteria\n"
            if custom_elements['resilience']['has_custom']:
                prompt += f"Resilience: {len(custom_elements['resilience']['high_risk_custom'])} high-risk scenarios requiring attention\n"
            if custom_elements['human_centricity']['has_custom']:
                custom_stmt_count = sum(len(v) for v in custom_elements['human_centricity']['custom_statements'].values())
                prompt += f"Human Centricity: {custom_stmt_count} custom evaluation statements\n"
        
        # Add priority areas
        if priority_areas:
            prompt += f"\n# PRIORITY AREAS (Most Critical):\n\n"
            for domain, areas in priority_areas.items():
                if domain in assessed_domains:  # Only show for assessed domains
                    prompt += f"{domain.title()}:\n"
                    for area in areas[:5]:
                        prompt += f"  - {area}\n"
        
        # Add knowledge base tips for DEFAULT criteria
        if tips:
            prompt += f"\n# IMPROVEMENT STRATEGIES (Default Criteria):\n\n"
            for domain, domain_tips in tips.items():
                if domain in assessed_domains:  # Only for assessed domains
                    prompt += f"{domain.title()} Improvements:\n"
                    for i, tip in enumerate(domain_tips[:5], 1):
                        prompt += f"  {i}. {tip}\n"
                    prompt += "\n"
        
        # Add CUSTOM ELEMENT TIPS
        if custom_tips:
            prompt += f"\n# CUSTOM ELEMENT RECOMMENDATIONS:\n\n"
            for key, custom_domain_tips in custom_tips.items():
                # Extract domain from key and check if it was assessed
                domain_from_key = self._extract_domain_from_tip_key(key)
                if domain_from_key not in assessed_domains:
                    continue
                
                # Parse key to make it readable
                if 'sustainability_' in key:
                    criterion_id = key.replace('sustainability_', '')
                    prompt += f"Custom Sustainability Criterion ({criterion_id}):\n"
                elif 'resilience_' in key and 'highrisk' in key:
                    domain_name = key.replace('resilience_', '').replace('_highrisk', '')
                    prompt += f"High-Risk {domain_name} Scenarios:\n"
                elif 'human_centricity_' in key:
                    hc_domain = key.replace('human_centricity_', '').replace('_custom', '')
                    prompt += f"Custom {hc_domain} Statements:\n"
                
                for tip in custom_domain_tips:
                    prompt += f"  - {tip}\n"
                prompt += "\n"
        
        # Add detailed metrics context (summarized)
        prompt += f"\n# DETAILED CONTEXT:\n\n"
        prompt += self._summarize_detailed_metrics(detailed_metrics, assessed_domains)
        
        # Build valid categories for each assessed domain
        valid_categories = self._get_valid_categories(detailed_metrics, assessed_domains)
        
        # Final instructions - CRITICAL: Only assessed domains with valid categories
        prompt += f"""

# VALID CATEGORIES FOR RECOMMENDATIONS

You MUST use ONLY these categories for each domain:

"""
        for domain in sorted(assessed_domains):
            if domain in valid_categories:
                categories = valid_categories[domain]
                prompt += f"{domain.upper()}: {', '.join(categories)}\n"
        
        prompt += f"""

# YOUR TASK:

Generate 8-12 prioritized recommendations in french with actionable exemples to improve this digital twin system.

CRITICAL CONSTRAINTS:
1. Generate recommendations ONLY for these domains: {', '.join(sorted(assessed_domains))}
2. Use ONLY the valid categories listed above - do NOT invent new categories
3. Do NOT generate recommendations for: {', '.join(sorted(unassessed_domains)) if unassessed_domains else 'N/A (all domains assessed)'}
4. Do NOT make up metrics or dimensions that weren't evaluated
5. Every recommendation must use a valid category from the list above
6. Do NOT duplicate categories - each category should have at most ONE recommendation
7. Do NOT generate "Mean Risk Reduction", "Risk Reduction", or other invented categories
7. Each recommendation must be concrete and actionable (not generic platitudes)
   Example of BAD: "Improve system performance"
   Example of GOOD: "Add real-time monitoring dashboard showing data freshness, updated every 5 minutes"
8. Vary recommendation approaches - don't give the same type of fix repeatedly
   If one recommendation is "add UI element", next should be "process change" or "training initiative"

FOCUS AREAS:
1. Address the lowest-scoring domains first
2. Prioritize custom criteria/scenarios/statements if present
3. Be specific and actionable
4. Estimate potential score improvement
5. Indicate implementation effort (Low/Medium/High)
6. Assign priority (Critical/High/Medium/Low)

Output format (JSON):
[
  {{
    "domain": "sustainability",
    "category": "social",
    "title": "Recommendation title",
    "description": "Specific action...",
    "priority": "high",
    "estimated_impact": "+5-8 points",
    "implementation_effort": "medium",
    "criterion_id": "SOC_01"
  }}
]

REMEMBER: 
- ONLY use categories from the valid list above
- Do NOT invent categories
- Use each category at most once

Generate recommendations NOW:"""
        
        return prompt
    
    # ADD these helper methods to the AIRecommendationEngine class
    
    def _get_assessed_scope(self, detailed_metrics: Dict[str, Any], assessed_domains: set) -> Dict[str, Any]:
        """Extract what was actually assessed in each domain"""
        scope = {}
        
        if "sustainability" in assessed_domains and "sustainability" in detailed_metrics:
            sus_data = detailed_metrics["sustainability"]
            if "sustainability_metrics" in sus_data:
                selected = sus_data["sustainability_metrics"].get("selected_domains", [])
                scope["sustainability_dimensions"] = selected
            elif "dimension_scores" in sus_data:
                scope["sustainability_dimensions"] = list(sus_data["dimension_scores"].keys())
        
        if "resilience" in assessed_domains and "resilience" in detailed_metrics:
            res_data = detailed_metrics["resilience"]
            if "risk_metrics" in res_data:
                domains_processed = res_data["risk_metrics"].get("domains_processed", 0)
                scope["resilience_domains_processed"] = domains_processed
        
        if "human_centricity" in assessed_domains and "human_centricity" in detailed_metrics:
            hc_data = detailed_metrics["human_centricity"]
            if "domain_scores" in hc_data:
                scope["human_centricity_dimensions"] = list(hc_data["domain_scores"].keys())
        
        return scope
    
    def _format_assessment_scope(self, scope: Dict[str, Any]) -> str:
        """Format assessment scope for the prompt"""
        lines = []
        
        if "sustainability_dimensions" in scope:
            dims = scope["sustainability_dimensions"]
            lines.append(f"- Sustainability evaluated for: {', '.join(dims) if dims else 'NONE'}")
        
        if "resilience_domains_processed" in scope:
            lines.append(f"- Resilience: {scope['resilience_domains_processed']} domains evaluated")
        
        if "human_centricity_dimensions" in scope:
            dims = scope["human_centricity_dimensions"]
            lines.append(f"- Human Centricity evaluated for: {', '.join(dims) if dims else 'NONE'}")
        
        return "\n".join(lines) if lines else "Standard assessment"
    
    def _extract_domain_from_tip_key(self, key: str) -> str:
        """Extract domain from custom tip key"""
        if key.startswith("sustainability_"):
            return "sustainability"
        elif key.startswith("resilience_"):
            return "resilience"
        elif key.startswith("human_centricity_"):
            return "human_centricity"
        return "unknown"
    
    def _get_valid_categories(self, detailed_metrics: Dict[str, Any], 
                             assessed_domains: set) -> Dict[str, List[str]]:
        """Extract valid categories for each assessed domain from actual assessment data"""
        valid_categories = {}
        
        # SUSTAINABILITY: Get dimensions that were actually assessed
        if "sustainability" in assessed_domains and "sustainability" in detailed_metrics:
            sus_data = detailed_metrics["sustainability"]
            categories = []
            
            # Check sustainability_metrics for selected_domains
            if "sustainability_metrics" in sus_data:
                selected = sus_data["sustainability_metrics"].get("selected_domains", [])
                if selected:
                    categories = selected
            
            # Fallback to dimension_scores
            if not categories and "dimension_scores" in sus_data:
                categories = list(sus_data["dimension_scores"].keys())
            
            if categories:
                valid_categories["sustainability"] = categories
        
        # RESILIENCE: Get resilience sub-domains that were actually evaluated
        if "resilience" in assessed_domains and "resilience" in detailed_metrics:
            res_data = detailed_metrics["resilience"]
            categories = []
            
            if "risk_metrics" in res_data:
                detailed_metrics_res = res_data["risk_metrics"].get("detailed_metrics", {})
                if detailed_metrics_res:
                    categories = list(detailed_metrics_res.keys())
            
            if categories:
                valid_categories["resilience"] = categories
        
        # HUMAN_CENTRICITY: Get domains that were actually evaluated
        if "human_centricity" in assessed_domains and "human_centricity" in detailed_metrics:
            hc_data = detailed_metrics["human_centricity"]
            categories = []
            
            # Get from domain_scores or detailed_metrics
            if "domain_scores" in hc_data:
                categories = list(hc_data["domain_scores"].keys())
            elif "detailed_metrics" in hc_data:
                categories = list(hc_data["detailed_metrics"].keys())
            
            if categories:
                valid_categories["human_centricity"] = categories
        
        return valid_categories
    
    def _summarize_detailed_metrics(self, detailed_metrics: Dict[str, Any], 
                                   assessed_domains: set) -> str:
        """Summarize only assessed domain metrics"""
        summary = []
        
        # Only process domains that were assessed
        if "sustainability" in assessed_domains and "sustainability" in detailed_metrics:
            sus = detailed_metrics["sustainability"]
            if "dimension_scores" in sus:
                dims = sus["dimension_scores"]
                summary.append(f"Sustainability (assessed): {', '.join(f'{k}={v:.1f}' for k, v in dims.items())}")
        
        if "resilience" in assessed_domains and "resilience" in detailed_metrics:
            res = detailed_metrics["resilience"]
            if "risk_metrics" in res:
                risk = res["risk_metrics"]
                # Get actual resilience sub-domains that were evaluated
                detailed = risk.get("detailed_metrics", {})
                evaluated_subdomains = list(detailed.keys())
                
                if evaluated_subdomains:
                    subdomain_scores = []
                    for subdomain in evaluated_subdomains:
                        score = detailed[subdomain].get("resilience_score", 0)
                        subdomain_scores.append(f"{subdomain}={score:.1f}")
                    summary.append(f"Resilience (evaluated: {', '.join(evaluated_subdomains)}): {', '.join(subdomain_scores)}")
                    summary.append(f"  Mean Risk Score: {risk.get('overall_mean_risk', 0):.1f}/25, High-Risk scenarios: {risk.get('risk_levels', {}).get('high', 0)}")
                else:
                    summary.append(f"Resilience Risk: Mean={risk.get('overall_mean_risk', 0):.1f}/25")
        
        if "human_centricity" in assessed_domains and "human_centricity" in detailed_metrics:
            hc = detailed_metrics["human_centricity"]
            if "domain_scores" in hc:
                dims = hc["domain_scores"]
                summary.append(f"Human Centricity (assessed): {', '.join(f'{k}={v:.1f}' for k, v in dims.items())}")
        
        return "\n".join(summary)
    
    

    
    async def _call_llm_with_fallback(self, prompt: str) -> str:
        """
        Call LLM with fallback chain: Groq → NVIDIA → Raise Error
        """
        errors = []
        
        # Try Groq first
        if self.groq_client:
            try:
                response = await self._call_groq(prompt)
                self.current_model = f"groq-{self.groq_model}"
                return response
            except Exception as e:
                logger.warning(f"Groq API failed: {e}")
                errors.append(f"Groq: {e}")
        
        # Fallback to NVIDIA NIM
        if self.nvidia_client:
            try:
                response = await self._call_nvidia(prompt)
                self.current_model = f"nvidia-{self.nvidia_model}"
                return response
            except Exception as e:
                logger.warning(f"NVIDIA API failed: {e}")
                errors.append(f"NVIDIA: {e}")
        
        # All APIs failed
        error_msg = f"All LLM APIs failed: {'; '.join(errors)}"
        logger.error(error_msg)
        raise Exception(error_msg)
    
    async def _call_groq(self, prompt: str) -> str:
        """Call Groq API"""
        try:
            completion = await self.groq_client.chat.completions.create(
                model=self.groq_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert digital twin consultant. Provide recommendations in valid JSON format. Pay special attention to custom assessment elements."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=2500,
                timeout=self.timeout
            )
            
            return completion.choices[0].message.content
            
        except Exception as e:
            logger.error(f"Groq API error: {e}")
            raise
    
    async def _call_nvidia(self, prompt: str) -> str:
        """Call NVIDIA NIM API"""
        try:
            completion = await self.nvidia_client.chat.completions.create(
                model=self.nvidia_model,
                messages=[
                    {
                        "role": "system",
                        "content": "You are an expert digital twin consultant. Provide recommendations in valid JSON format. Pay special attention to custom assessment elements."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                temperature=0.7,
                max_tokens=2500,
                timeout=self.timeout
            )
            
            return completion.choices[0].message.content
            
        except Exception as e:
            logger.error(f"NVIDIA API error: {e}")
            raise
    
    def _parse_llm_response(self, response: str, assessment_data: Dict[str, Any]) -> List[Recommendation]:
        """Parse LLM response into structured Recommendation objects"""
        try:
            # Extract JSON from response (handle markdown code blocks)
            response = response.strip()
            if "```json" in response:
                response = response.split("```json")[1].split("```")[0]
            elif "```" in response:
                response = response.split("```")[1].split("```")[0]
            
            # Parse JSON
            recommendations_data = json.loads(response)
            
            # Convert to Recommendation objects
            recommendations = []
            for i, rec_data in enumerate(recommendations_data):
                try:
                    recommendation = Recommendation(
                        domain=rec_data.get("domain", "general"),
                        category=rec_data.get("category", "general"),
                        title=rec_data.get("title", f"Recommendation {i+1}"),
                        description=rec_data.get("description", ""),
                        priority=rec_data.get("priority", "medium").lower(),
                        estimated_impact=rec_data.get("estimated_impact"),
                        implementation_effort=rec_data.get("implementation_effort", "medium").lower(),
                        source="ai",
                        criterion_id=rec_data.get("criterion_id"),  # Capture custom criterion ID
                        confidence_score=0.85
                    )
                    recommendations.append(recommendation)
                except Exception as e:
                    logger.warning(f"Failed to parse recommendation {i}: {e}")
            
            logger.info(f"Parsed {len(recommendations)} recommendations from LLM response")
            return recommendations
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse JSON from LLM response: {e}")
            logger.debug(f"Response was: {response[:500]}")
            
            # Attempt text parsing as fallback
            return self._parse_text_response(response, assessment_data)
    
    def _parse_text_response(self, response: str, assessment_data: Dict[str, Any]) -> List[Recommendation]:
        """Fallback parser for non-JSON responses"""
        recommendations = []
        
        # Simple heuristic parsing
        lines = [l.strip() for l in response.split('\n') if l.strip()]
        
        current_rec = None
        for line in lines:
            if line.startswith(('1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')) or line.startswith('-'):
                if current_rec:
                    recommendations.append(current_rec)
                
                # Start new recommendation
                current_rec = Recommendation(
                    domain="general",
                    category="general",
                    title=line.lstrip('0123456789.- '),
                    description="",
                    priority="medium",
                    source="ai"
                )
            elif current_rec:
                current_rec.description += " " + line
        
        if current_rec:
            recommendations.append(current_rec)
        
        logger.info(f"Parsed {len(recommendations)} recommendations from text")
        return recommendations[:10]  # Limit to 10
    
    def _fallback_recommendations(self, assessment_data: Dict[str, Any]) -> List[Recommendation]:
        """
        Generate basic rule-based recommendations when AI fails.
        Uses existing rule-based recommendations from detailed_metrics.
        """
        recommendations = []
        detailed_metrics = assessment_data.get("detailed_metrics", {})
        
        # Extract existing recommendations from each domain
        for domain, metrics in detailed_metrics.items():
            # Try different possible locations for recommendations
            recs = None
            if isinstance(metrics, dict):
                # Check direct recommendations
                if "recommendations" in metrics:
                    recs = metrics["recommendations"]
                # Check nested in sustainability_metrics
                elif "sustainability_metrics" in metrics and "recommendations" in metrics["sustainability_metrics"]:
                    recs = metrics["sustainability_metrics"]["recommendations"]
            
            if recs:
                for rec_text in recs[:5]:  # Limit to 5 per domain
                    recommendations.append(Recommendation(
                        domain=domain,
                        category="general",
                        title=rec_text[:80] if len(rec_text) > 80 else rec_text,
                        description=rec_text,
                        priority="medium",
                        source="rule_based"
                    ))
        
        logger.info(f"Using {len(recommendations)} fallback rule-based recommendations")
        return recommendations[:10]  # Limit total to 10