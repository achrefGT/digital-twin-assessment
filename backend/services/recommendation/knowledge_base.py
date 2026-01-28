"""
Knowledge Base - Stores and retrieves improvement tips
Day 2 deliverable: Simple JSON-based keyword search
"""

import json
import logging
import os
from typing import List, Dict, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class KnowledgeBase:
    """
    Simple knowledge base for improvement tips.
    Loads from JSON files, provides keyword-based search.
    """
    
    def __init__(self, data_dir: str = "knowledge_base/data"):
        self.data_dir = Path(data_dir)
        self.tips = {
            "sustainability": [],
            "resilience": [],
            "human_centricity": []
        }
        
        self._load_tips()
    
    def _load_tips(self):
        """Load tips from JSON files"""
        for domain in ["sustainability", "resilience", "human_centricity"]:
            file_path = self.data_dir / f"{domain}_tips.json"
            
            if file_path.exists():
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        self.tips[domain] = data.get("tips", [])
                    
                    logger.info(f"Loaded {len(self.tips[domain])} tips for {domain}")
                except Exception as e:
                    logger.error(f"Failed to load {file_path}: {e}")
            else:
                logger.warning(f"Tips file not found: {file_path}")
    
    def get_tips(
        self,
        domain: str,
        score: float,
        detailed_metrics: Dict[str, Any],
        max_tips: int = 10
    ) -> List[str]:
        """
        Get relevant tips for a domain based on score and metrics.
        Simple keyword matching for Day 2, can be enhanced later.
        """
        if domain not in self.tips:
            return []
        
        all_tips = self.tips[domain]
        
        # Filter tips based on score range
        relevant_tips = []
        for tip in all_tips:
            if self._is_relevant(tip, score, detailed_metrics):
                relevant_tips.append(tip.get("description", tip.get("text", "")))
        
        # Return top N
        return relevant_tips[:max_tips]
    
    def _is_relevant(self, tip: Dict[str, Any], score: float, detailed_metrics: Dict[str, Any]) -> bool:
        """
        Determine if a tip is relevant based on score and metrics.
        Simple heuristic matching.
        """
        # Check score range
        min_score = tip.get("min_score", 0)
        max_score = tip.get("max_score", 100)
        
        if not (min_score <= score <= max_score):
            return False
        
        # Check category/criterion match
        categories = tip.get("categories", [])
        if categories:
            # Check if any low-performing category matches
            for category in categories:
                if self._category_needs_improvement(category, detailed_metrics):
                    return True
            return False
        
        return True
    
    def _category_needs_improvement(self, category: str, detailed_metrics: Dict[str, Any]) -> bool:
        """Check if a category needs improvement based on detailed metrics"""
        # Sustainability
        if "dimension_scores" in detailed_metrics:
            dims = detailed_metrics["dimension_scores"]
            if category.lower() in [k.lower() for k in dims.keys()]:
                return dims.get(category, 100) < 60
        
        # Resilience
        if "domain_scores" in detailed_metrics:
            domains = detailed_metrics["domain_scores"]
            if category in domains:
                return domains[category] < 65
        
        # Human Centricity
        if "detailed_metrics" in detailed_metrics:
            hc_domains = detailed_metrics["detailed_metrics"]
            if category in hc_domains:
                domain_data = hc_domains[category]
                score = domain_data.get("score", 100)
                return score < 55
        
        return False
    
    def search(self, keywords: List[str], domain: str = None, max_results: int = 10) -> List[str]:
        """
        Simple keyword search across tips.
        """
        domains_to_search = [domain] if domain else list(self.tips.keys())
        results = []
        
        for d in domains_to_search:
            for tip in self.tips[d]:
                tip_text = tip.get("description", tip.get("text", "")).lower()
                
                # Check if any keyword matches
                if any(kw.lower() in tip_text for kw in keywords):
                    results.append(tip.get("description", tip.get("text", "")))
                    
                    if len(results) >= max_results:
                        return results
        
        return results


# ============================================================================
# Tip Generator - Day 2: Auto-generate tips using AI
# ============================================================================

async def generate_tips_with_ai(domain: str, criteria: List[Dict[str, Any]], output_file: str):
    """
    Generate tips for default criteria using AI.
    Run this once to bootstrap the knowledge base.
    """
    from groq import AsyncGroq
    import asyncio
    
    groq_client = AsyncGroq(api_key=os.getenv("RECOMMENDATION_GROQ_API_KEY"))
    all_tips = []
    
    logger.info(f"Generating tips for {domain} ({len(criteria)} criteria)...")
    
    for criterion in criteria:
        criterion_name = criterion.get("name", criterion.get("id", "Unknown"))
        
        prompt = f"""Generate 5 specific, actionable improvement tips for this digital twin assessment criterion:

Domain: {domain}
Criterion: {criterion_name}
Description: {criterion.get('description', 'N/A')}

Each tip should be:
1. Specific and actionable (not generic)
2. Practical to implement
3. Relevant to digital twin systems
4. 1-2 sentences long

Format as JSON:
[
  {{"description": "tip 1", "priority": "high", "categories": ["{domain}"], "min_score": 0, "max_score": 60}},
  ...
]"""
        
        try:
            response = await groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                max_tokens=1000
            )
            
            content = response.choices[0].message.content
            
            # Extract JSON
            if "```json" in content:
                content = content.split("```json")[1].split("```")[0]
            elif "```" in content:
                content = content.split("```")[1].split("```")[0]
            
            tips = json.loads(content)
            all_tips.extend(tips)
            
            logger.info(f"✓ Generated {len(tips)} tips for {criterion_name}")
            
            # Rate limiting
            await asyncio.sleep(2)
            
        except Exception as e:
            logger.error(f"Failed to generate tips for {criterion_name}: {e}")
    
    # Save to file
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"domain": domain, "tips": all_tips}, f, indent=2, ensure_ascii=False)
    
    logger.info(f"Saved {len(all_tips)} tips to {output_file}")


# ============================================================================
# CLI for generating tips - Day 2
# ============================================================================

if __name__ == "__main__":
    import asyncio
    
    # Example: Generate sustainability tips
    sustainability_criteria = [
        {"name": "Budget de numérisation", "id": "ECO_01"},
        {"name": "Économies réalisées", "id": "ECO_02"},
        {"name": "Amélioration des performances", "id": "ECO_03"},
        {"name": "Délai de retour sur investissement", "id": "ECO_04"},
        {"name": "Suivi des flux", "id": "ENV_02"},
        {"name": "Visibilité énergétique", "id": "ENV_03"},
        {"name": "Périmètre environnemental", "id": "ENV_04"},
        {"name": "Simulation et prédiction", "id": "ENV_05"},
        {"name": "Réalité du jumeau numérique", "id": "ENV_01"},
        {"name": "Impact sur les employés", "id": "SOC_01"},
        {"name": "Sécurité au travail", "id": "SOC_02"},
        {"name": "Bénéfices régionaux", "id": "SOC_03"},
    ]
    
    asyncio.run(generate_tips_with_ai(
        domain="sustainability",
        criteria=sustainability_criteria,
        output_file="knowledge_base/data/sustainability_tips.json"
    ))
    
    print("\n✓ Tips generated! Run for other domains to complete knowledge base.")