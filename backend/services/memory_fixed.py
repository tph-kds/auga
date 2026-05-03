import sqlite3
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from pathlib import Path

Base = declarative_base()

class PlanRecord(Base):
    __tablename__ = 'plans'

    id = Column(Integer, primary_key=True)
    workflow_id = Column(String, unique=True)
    user_input = Column(Text)
    plan = Column(Text)  # JSON string
    environment = Column(String)
    algorithm = Column(String)
    target_score = Column(Float)
    metrics = Column(Text)  # JSON
    success = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)

class MemorySystem:
    def __init__(self, db_path: str = 'data/memory/memory.db'):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(f'sqlite:///{self.db_path}')
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        self.Session = sessionmaker(bind=engine)

    def save_plan(self, workflow_id: str, user_input: str, plan: Dict, environment: str, algorithm: str, target_score: float, metrics: Dict = None, success: bool = False):
        session = self.Session()
        record = PlanRecord(
            workflow_id=workflow_id,
            user_input=user_input,
            plan=json.dumps(plan),
            environment=environment,
            algorithm=algorithm,
            target_score=target_score,
            metrics=json.dumps(metrics) if metrics else None,
            success=1 if success else 0
        )
        session.add(record)
        session.commit()
        session.close()

    def store_plan(self, plan):
        """Legacy alias."""
        self.save_plan(
            workflow_id=plan.metadata.get('workflow_id', 'unknown'),
            user_input=plan.metadata.get('raw_input', ''),
            plan=plan.to_dict(),
            environment=plan.game_type.value,
            algorithm=plan.algorithm.value,
            target_score=plan.target_value
        )

    def get_recent_plans(self, limit: int = 10) -> List[Dict]:
        session = self.Session()
        records = session.query(PlanRecord).order_by(PlanRecord.created_at.desc()).limit(limit).all()
        plans = []
        for r in records:
            plans.append({
                'id': r.id,
                'workflow_id': r.workflow_id,
                'user_input': r.user_input,
                'environment': r.environment,
                'algorithm': r.algorithm,
                'target_score': r.target_score,
                'success': bool(r.success),
                'created_at': r.created_at.isoformat() if r.created_at else None
            })
        session.close()
        return plans

    def get_plan(self, workflow_id: str) -> Optional[Dict]:
        session = self.Session()
        record = session.query(PlanRecord).filter_by(workflow_id=workflow_id).first()
        if record:
            return {
                'user_input': record.user_input,
                'plan': json.loads(record.plan),
                'metrics': json.loads(record.metrics) if record.metrics else None
            }
        session.close()
        return None

memory = MemorySystem()

