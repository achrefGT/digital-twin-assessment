import uuid
from datetime import datetime
from typing import Dict, Any, List, Optional, Set
import logging

from .models import (
    StatementCreate, StatementUpdate, StatementResponse,
    HumanCentricityDomain, FIXED_DOMAINS, DEFAULT_STATEMENTS, 
    ASSESSMENT_SCALES, ASSESSMENT_STRUCTURE, StatementManager as ModelStatementManager,
    StatementType
)
from .database import DatabaseManager, DynamicStatement

logger = logging.getLogger(__name__)


class StatementManager:
    """Statement management system for fixed domains with custom statements"""
    
    def __init__(self, db_manager: DatabaseManager):
        self.db_manager = db_manager
        self.scales = ASSESSMENT_SCALES
        self.fixed_domains = FIXED_DOMAINS
        self.default_statements = DEFAULT_STATEMENTS
        self._ensure_dynamic_tables()
        self._initialize_default_statements()
    
    def _ensure_dynamic_tables(self):
        """Ensure dynamic statement tables exist"""
        try:
            # Create tables if they don't exist
            self.db_manager.create_tables()
            logger.info("Dynamic statement tables created/verified successfully")
        except Exception as e:
            logger.error(f"Failed to create dynamic statement tables: {e}")
            raise
    
    def _initialize_default_statements(self):
        """Initialize default statements if database is empty"""
        try:
            # Check if we have any default statements
            existing_statements = self.db_manager.get_all_active_statements()
            default_statements_exist = any(stmt.is_default for stmt in existing_statements)
            
            if not default_statements_exist:
                logger.info("Initializing default statements for all domains")
                
                statements_to_create = []
                
                for domain, statements_list in self.default_statements.items():
                    for idx, statement_config in enumerate(statements_list):
                        statement_data = {
                            'id': str(uuid.uuid4()),
                            'domain_key': domain.value,
                            'statement_text': statement_config['text'],
                            'widget': statement_config.get('widget', 'likert'),
                            'scale_key': statement_config.get('scale_key', 'likert_7_point'),
                            'widget_config': statement_config.get('widget_config', {}),
                            'display_order': statement_config.get('display_order', idx),
                            'is_required': True,
                            'is_active': True,
                            'is_default': statement_config.get('is_default', True),
                            'meta_data': {}
                        }
                        statements_to_create.append(statement_data)
                
                # Bulk create all default statements
                if statements_to_create:
                    self.db_manager.bulk_create_default_statements(statements_to_create)
                    logger.info(f"Initialized {len(statements_to_create)} default statements")
            
        except Exception as e:
            logger.error(f"Failed to initialize default statements: {e}")
            raise
    
    # Domain Information Methods (Read-only for fixed domains)
    
    def get_all_domains(self) -> Dict[HumanCentricityDomain, Dict[str, Any]]:
        """Get all fixed domains with their configuration and statement counts"""
        result = {}
        statement_counts = self.db_manager.get_statement_count_by_domain()
        
        for domain, config in self.fixed_domains.items():
            domain_info = config.copy()
            domain_info['statement_count'] = statement_counts.get(domain.value, 0)
            result[domain] = domain_info
        
        return result
    
    def get_domain_info(self, domain: HumanCentricityDomain) -> Optional[Dict[str, Any]]:
        """Get information about a specific fixed domain"""
        domain_config = self.fixed_domains.get(domain)
        if not domain_config:
            return None
        
        statement_count = len(self.db_manager.get_statements_by_domain(domain.value))
        domain_info = domain_config.copy()
        domain_info['statement_count'] = statement_count
        
        return domain_info
    
    def get_enabled_domains(self) -> List[HumanCentricityDomain]:
        """Get list of all enabled domains (all fixed domains are enabled)"""
        return list(self.fixed_domains.keys())
    
    # Statement Management Methods
    
    def get_all_statements(self) -> List[StatementResponse]:
        """Get all active statements"""
        db_statements = self.db_manager.get_all_active_statements()
        return [self._db_statement_to_response(stmt) for stmt in db_statements]
    
    def get_statements_by_domain(self, domain: HumanCentricityDomain) -> List[StatementResponse]:
        """Get statements for specific domain"""
        db_statements = self.db_manager.get_statements_by_domain(domain.value, active_only=True)
        return [self._db_statement_to_response(stmt) for stmt in db_statements]
    
    def get_statement_by_id(self, statement_id: str) -> Optional[StatementResponse]:
        """Get statement by ID"""
        db_statement = self.db_manager.get_statement(statement_id)
        if not db_statement or not db_statement.is_active:
            return None
        return self._db_statement_to_response(db_statement)
    
    def create_statement(self, statement_data: StatementCreate) -> StatementResponse:
        """Create new custom statement"""
        # Validate domain exists
        if statement_data.domain_key not in self.fixed_domains:
            raise ValueError(f"Domain '{statement_data.domain_key.value}' does not exist in fixed domains")
        
        # Validate statement data against domain constraints
        validation_result = ModelStatementManager.validate_statement_for_domain(
            statement_data.domain_key, 
            statement_data.dict()
        )
        
        if not validation_result['valid']:
            raise ValueError(f"Statement validation failed: {', '.join(validation_result['errors'])}")
        
        # Create statement data for database
        db_statement_data = {
            'id': str(uuid.uuid4()),
            'domain_key': statement_data.domain_key.value,
            'statement_text': statement_data.statement_text,
            'widget': statement_data.widget,
            'scale_key': statement_data.scale_key,
            'widget_config': statement_data.widget_config or {},
            'display_order': statement_data.display_order,
            'is_required': statement_data.is_required,
            'is_active': statement_data.is_active,
            'is_default': False, 
            'meta_data': statement_data.meta_data or {}
        }
        
        db_statement = self.db_manager.save_statement(db_statement_data)
        return self._db_statement_to_response(db_statement)
    
    def update_statement(self, statement_id: str, statement_update: StatementUpdate) -> Optional[StatementResponse]:
        """Update existing statement"""
        # Get existing statement
        db_statement = self.db_manager.get_statement(statement_id)
        if not db_statement:
            return None
        
        # Prepare update data
        update_data = {}
        for field, value in statement_update.dict(exclude_unset=True).items():
            if value is not None:
                update_data[field] = value
        
        if update_data:
            updated_statement = self.db_manager.update_statement(statement_id, update_data)
            if updated_statement:
                return self._db_statement_to_response(updated_statement)
        
        return None
    
    def delete_statement(self, statement_id: str) -> bool:
        """Delete statement (soft delete by setting is_active=False for default statements)"""
        db_statement = self.db_manager.get_statement(statement_id)
        if not db_statement:
            return False
        
        if db_statement.is_default:
            # Soft delete default statements
            return self.db_manager.update_statement(statement_id, {'is_active': False}) is not None
        else:
            # Hard delete custom statements
            return self.db_manager.delete_statement(statement_id)
    
    def reorder_statements_in_domain(self, domain: HumanCentricityDomain, statement_ids: List[str]) -> bool:
        """Reorder statements within a domain"""
        try:
            # Get all statements for the domain to validate
            domain_statements = self.db_manager.get_statements_by_domain(domain.value, active_only=True)
            domain_statement_ids = {stmt.id for stmt in domain_statements}
            
            # Validate all provided IDs exist in the domain
            provided_ids = set(statement_ids)
            if not provided_ids.issubset(domain_statement_ids):
                invalid_ids = provided_ids - domain_statement_ids
                raise ValueError(f"Statement IDs do not belong to domain {domain.value}: {invalid_ids}")
            
            # Update display orders
            for idx, statement_id in enumerate(statement_ids):
                self.db_manager.update_statement(statement_id, {'display_order': idx})
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to reorder statements in domain {domain.value}: {e}")
            return False
    
    def reset_domain_to_defaults(self, domain: HumanCentricityDomain) -> bool:
        """Reset domain statements to defaults"""
        try:
            # Delete all existing statements for this domain
            self.db_manager.reset_domain_statements(domain.value)
            
            # Get default statements for this domain
            default_statements = self.default_statements.get(domain, [])
            if not default_statements:
                logger.warning(f"No default statements found for domain {domain.value}")
                return True
            
            # Create default statements
            statements_to_create = []
            for idx, statement_config in enumerate(default_statements):
                statement_data = {
                    'id': str(uuid.uuid4()),
                    'domain_key': domain.value,
                    'statement_text': statement_config['text'],
                    'widget': statement_config.get('widget', 'likert'),
                    'scale_key': statement_config.get('scale_key', 'likert_7_point'),
                    'widget_config': statement_config.get('widget_config', {}),
                    'display_order': statement_config.get('display_order', idx),
                    'is_required': True,
                    'is_active': True,
                    'is_default': True,
                    'meta_data': {}
                }
                statements_to_create.append(statement_data)
            
            # Bulk create default statements
            if statements_to_create:
                self.db_manager.bulk_create_default_statements(statements_to_create)
                logger.info(f"Reset domain {domain.value} to {len(statements_to_create)} default statements")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to reset domain {domain.value} to defaults: {e}")
            return False
    
    def duplicate_statement(self, statement_id: str, new_statement_text: Optional[str] = None) -> Optional[StatementResponse]:
        """Duplicate an existing statement"""
        # Get the original statement
        original_statement = self.db_manager.get_statement(statement_id)
        if not original_statement:
            return None
        
        # Create duplicate data
        duplicate_data = {
            'domain_key': original_statement.domain_key,
            'statement_text': new_statement_text or f"Copy of {original_statement.statement_text}",
            'widget': original_statement.widget,
            'scale_key': original_statement.scale_key,
            'widget_config': original_statement.widget_config or {},
            'display_order': original_statement.display_order + 1,  # Place after original
            'is_required': original_statement.is_required,
            'is_active': True,
            'is_default': False,  # Duplicates are never default
            'meta_data': original_statement.meta_data or {}
        }
        
        try:
            db_statement = self.db_manager.save_statement(duplicate_data)
            return self._db_statement_to_response(db_statement)
        except Exception as e:
            logger.error(f"Failed to duplicate statement {statement_id}: {e}")
            return None
    
    # Scale and Configuration Methods
    
    def get_all_scales(self) -> Dict[str, Dict[str, Any]]:
        """Get all available assessment scales"""
        return self.scales
    
    def get_scale_info(self, scale_key: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific scale"""
        return self.scales.get(scale_key)
    
    def get_compatible_widgets_for_domain(self, domain: HumanCentricityDomain) -> List[str]:
        """Get list of compatible widgets for a domain"""
        return ModelStatementManager._get_compatible_widgets(domain)
    
    def get_compatible_scales_for_domain(self, domain: HumanCentricityDomain) -> List[str]:
        """Get list of compatible scales for a domain"""
        return ModelStatementManager._get_compatible_scales(domain)
    
    def get_statement_template_for_domain(self, domain: HumanCentricityDomain) -> Dict[str, Any]:
        """Get a template for creating new statements in a domain"""
        return ModelStatementManager.get_statement_template(domain)
    
    # Assessment Structure Methods
    
    def get_assessment_structure(self) -> Dict[str, Any]:
        """Get complete assessment structure including domains, statements, and scales"""
        structure = {
            'domains': {},
            'statements': {},
            'scales': self.scales,
            'metadata': ASSESSMENT_STRUCTURE
        }
        
        # Get domains with statements
        for domain in self.fixed_domains.keys():
            domain_info = self.get_domain_info(domain)
            domain_statements = self.get_statements_by_domain(domain)
            
            structure['domains'][domain.value] = {
                'config': domain_info,
                'statements': [stmt.dict() for stmt in domain_statements]
            }
            
            # Also add statements to flat structure for easy lookup
            for stmt in domain_statements:
                structure['statements'][stmt.id] = stmt.dict()
        
        return structure
    
    def validate_assessment_structure(self) -> Dict[str, Any]:
        """Validate current assessment structure against validation rules"""
        validation_rules = ASSESSMENT_STRUCTURE['validation_rules']
        validation_result = {
            'valid': True,
            'warnings': [],
            'errors': [],
            'stats': {}
        }
        
        # Get current statistics
        all_statements = self.get_all_statements()
        statement_counts = self.db_manager.get_statement_count_by_domain()
        
        validation_result['stats'] = {
            'total_statements': len(all_statements),
            'statements_by_domain': statement_counts,
            'active_domains': len([d for d, count in statement_counts.items() if count > 0])
        }
        
        # Validate against rules
        total_statements = len(all_statements)
        if total_statements > validation_rules['max_total_statements']:
            validation_result['errors'].append(
                f"Total statements ({total_statements}) exceeds maximum ({validation_rules['max_total_statements']})"
            )
            validation_result['valid'] = False
        
        # Check per-domain limits
        for domain_key, count in statement_counts.items():
            if count > validation_rules['max_statements_per_domain']:
                validation_result['errors'].append(
                    f"Domain {domain_key} has {count} statements, exceeds maximum ({validation_rules['max_statements_per_domain']})"
                )
                validation_result['valid'] = False
            elif count == 0:
                validation_result['warnings'].append(
                    f"Domain {domain_key} has no statements"
                )
        
        return validation_result
    
    def get_assessment_preview(self, selected_domains: Optional[Set[HumanCentricityDomain]] = None) -> Dict[str, Any]:
        """Get preview of assessment based on selected domains"""
        if selected_domains is None:
            selected_domains = set(self.fixed_domains.keys())
        
        preview = {
            'selected_domains': [d.value for d in selected_domains],
            'total_statements': 0,
            'estimated_time_minutes': 0,
            'domains': {}
        }
        
        for domain in selected_domains:
            statements = self.get_statements_by_domain(domain)
            domain_info = self.get_domain_info(domain)
            
            preview['domains'][domain.value] = {
                'title': domain_info['title'],
                'description': domain_info['description'],
                'statement_count': len(statements),
                'estimated_time_seconds': len(statements) * 15  # ~15 seconds per statement
            }
            
            preview['total_statements'] += len(statements)
            preview['estimated_time_minutes'] += (len(statements) * 15) // 60
        
        return preview
    
    # Bulk Operations
    
    def bulk_update_statements(self, updates: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Bulk update multiple statements"""
        results = {
            'successful': [],
            'failed': [],
            'total': len(updates)
        }
        
        for update_item in updates:
            statement_id = update_item.get('id')
            update_data = update_item.get('data', {})
            
            if not statement_id:
                results['failed'].append({'id': None, 'error': 'Missing statement ID'})
                continue
            
            try:
                statement_update = StatementUpdate(**update_data)
                updated_statement = self.update_statement(statement_id, statement_update)
                
                if updated_statement:
                    results['successful'].append(updated_statement.dict())
                else:
                    results['failed'].append({'id': statement_id, 'error': 'Statement not found'})
                    
            except Exception as e:
                results['failed'].append({'id': statement_id, 'error': str(e)})
        
        return results
    
    def bulk_delete_statements(self, statement_ids: List[str]) -> Dict[str, Any]:
        """Bulk delete multiple statements"""
        results = {
            'successful': [],
            'failed': [],
            'total': len(statement_ids)
        }
        
        for statement_id in statement_ids:
            try:
                if self.delete_statement(statement_id):
                    results['successful'].append(statement_id)
                else:
                    results['failed'].append({'id': statement_id, 'error': 'Statement not found or deletion failed'})
            except Exception as e:
                results['failed'].append({'id': statement_id, 'error': str(e)})
        
        return results
    
    # Utility Methods
    
    def _db_statement_to_response(self, db_statement: DynamicStatement) -> StatementResponse:
        """Convert database statement to response model"""
        # Determine statement type from domain
        domain = HumanCentricityDomain(db_statement.domain_key)
        domain_config = self.fixed_domains.get(domain, {})
        statement_type = domain_config.get('statement_type', StatementType.SCALE)
        
        return StatementResponse(
            id=db_statement.id,
            domain_key=domain,
            statement_text=db_statement.statement_text,
            statement_type=statement_type,
            scale_key=db_statement.scale_key,
            widget=db_statement.widget,
            widget_config=db_statement.widget_config,
            display_order=db_statement.display_order,
            is_required=db_statement.is_required,
            is_active=db_statement.is_active,
            is_default=db_statement.is_default,
            meta_data=db_statement.meta_data or {},
            created_at=db_statement.created_at,
            updated_at=db_statement.updated_at
        )
    
    def export_statements(self, format: str = 'json', include_inactive: bool = False) -> Dict[str, Any]:
        """Export statements in specified format"""
        if include_inactive:
            # Get all statements including inactive ones
            db = self.db_manager.get_session()
            try:
                from sqlalchemy import or_
                db_statements = db.query(DynamicStatement).all()
            finally:
                db.close()
        else:
            db_statements = self.db_manager.get_all_active_statements()
        
        statements = [self._db_statement_to_response(stmt) for stmt in db_statements]
        
        export_data = {
            'export_timestamp': datetime.utcnow().isoformat(),
            'total_statements': len(statements),
            'include_inactive': include_inactive,
            'statements': [stmt.dict() for stmt in statements]
        }
        
        return export_data
    
    def import_statements(self, import_data: Dict[str, Any], overwrite_existing: bool = False) -> Dict[str, Any]:
        """Import statements from export data"""
        results = {
            'successful': [],
            'failed': [],
            'skipped': [],
            'total': 0
        }
        
        statements_data = import_data.get('statements', [])
        results['total'] = len(statements_data)
        
        for stmt_data in statements_data:
            try:
                statement_id = stmt_data.get('id')
                existing_statement = self.db_manager.get_statement(statement_id) if statement_id else None
                
                if existing_statement and not overwrite_existing:
                    results['skipped'].append({'id': statement_id, 'reason': 'Statement exists and overwrite disabled'})
                    continue
                
                # Prepare statement data for creation
                create_data = StatementCreate(
                    domain_key=HumanCentricityDomain(stmt_data['domain_key']),
                    statement_text=stmt_data['statement_text'],
                    widget=stmt_data.get('widget', 'likert'),
                    scale_key=stmt_data.get('scale_key', 'likert_7_point'),
                    widget_config=stmt_data.get('widget_config', {}),
                    display_order=stmt_data.get('display_order', 0),
                    is_required=stmt_data.get('is_required', True),
                    is_active=stmt_data.get('is_active', True),
                    meta_data=stmt_data.get('meta_data', {})
                )
                
                if existing_statement and overwrite_existing:
                    # Update existing statement
                    update_data = StatementUpdate(**create_data.dict(exclude={'domain_key'}))
                    updated_statement = self.update_statement(statement_id, update_data)
                    if updated_statement:
                        results['successful'].append(updated_statement.dict())
                    else:
                        results['failed'].append({'id': statement_id, 'error': 'Update failed'})
                else:
                    # Create new statement
                    new_statement = self.create_statement(create_data)
                    results['successful'].append(new_statement.dict())
                    
            except Exception as e:
                results['failed'].append({
                    'id': stmt_data.get('id', 'unknown'),
                    'error': str(e)
                })
        
        return results