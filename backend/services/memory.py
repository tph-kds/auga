"""
Memory System: SQLite-backed persistent storage for plans, experiments, and metrics.
Single canonical implementation — no duplicates.
"""
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Float
from sqlalchemy.orm import declarative_base, sessionmaker
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

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
    success = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExperimentRecord(Base):
    __tablename__ = 'experiments'

    id = Column(Integer, primary_key=True)
    workflow_id = Column(String)
    model_path = Column(String)
    environment = Column(String)
    algorithm = Column(String)
    mean_reward = Column(Float)
    success_rate = Column(Float)
    total_timesteps = Column(Integer)
    config = Column(Text)  # JSON
    created_at = Column(DateTime, default=datetime.utcnow)


class MemorySystem:
    """Persistent memory for plans, experiments, and metrics."""

    def __init__(self, db_path: str = 'data/memory/memory.db'):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(f'sqlite:///{self.db_path}', echo=False)
        # create_all only creates tables that don't exist yet — never drops
        Base.metadata.create_all(engine)
        self.Session = sessionmaker(bind=engine)

    def save_plan(
        self,
        workflow_id: str,
        user_input: str,
        plan: Dict,
        environment: str,
        algorithm: str,
        target_score: float,
        metrics: Dict = None,
        success: bool = False,
    ):
        """Persist a training plan."""
        session = self.Session()
        try:
            record = PlanRecord(
                workflow_id=workflow_id,
                user_input=user_input,
                plan=json.dumps(plan),
                environment=environment,
                algorithm=algorithm,
                target_score=target_score,
                metrics=json.dumps(metrics) if metrics else None,
                success=1 if success else 0,
            )
            session.add(record)
            session.commit()
        except Exception as e:
            session.rollback()
            logger.warning(f"Failed to save plan (duplicate?): {e}")
        finally:
            session.close()

    def store_plan(self, plan):
        """Legacy alias used by PlannerAgent."""
        self.save_plan(
            workflow_id=plan.metadata.get('workflow_id', 'unknown'),
            user_input=plan.metadata.get('raw_input', ''),
            plan=plan.to_dict(),
            environment=plan.game_type.value,
            algorithm=plan.algorithm.value,
            target_score=plan.target_value,
        )

    def save_experiment(
        self,
        workflow_id: str,
        model_path: str,
        environment: str,
        algorithm: str,
        mean_reward: float,
        success_rate: float,
        total_timesteps: int,
        config: Dict = None,
    ):
        """Persist an experiment result."""
        session = self.Session()
        try:
            record = ExperimentRecord(
                workflow_id=workflow_id,
                model_path=model_path,
                environment=environment,
                algorithm=algorithm,
                mean_reward=mean_reward,
                success_rate=success_rate,
                total_timesteps=total_timesteps,
                config=json.dumps(config) if config else None,
            )
            session.add(record)
            session.commit()
        except Exception:
            session.rollback()
        finally:
            session.close()

    def get_recent_plans(self, limit: int = 10) -> List[Dict]:
        session = self.Session()
        try:
            records = (
                session.query(PlanRecord)
                .order_by(PlanRecord.created_at.desc())
                .limit(limit)
                .all()
            )
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
                    'created_at': r.created_at.isoformat() if r.created_at else None,
                })
            return plans
        finally:
            session.close()

    def get_plan(self, workflow_id: str) -> Optional[Dict]:
        session = self.Session()
        try:
            record = session.query(PlanRecord).filter_by(workflow_id=workflow_id).first()
            if record:
                return {
                    'user_input': record.user_input,
                    'plan': json.loads(record.plan),
                    'metrics': json.loads(record.metrics) if record.metrics else None,
                }
            return None
        finally:
            session.close()


# Global singleton
memory = MemorySystem()
