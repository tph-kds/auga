"""
Notifications Service: SQLite-backed persistent notification storage.
Stores pipeline events, errors, and successes for the frontend.
"""
import json
import logging
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Dict, Any, Optional

from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker

logger = logging.getLogger(__name__)
Base = declarative_base()


class NotifLevel(str, Enum):
    INFO = "info"
    SUCCESS = "success"
    WARNING = "warning"
    ERROR = "error"


class NotificationRecord(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(String, nullable=True, index=True)
    level = Column(String, default=NotifLevel.INFO)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String, default="system")   # pipeline, training, eval, error, system
    meta_data = Column(Text, nullable=True)          # JSON blob
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class NotificationService:
    """Persistent notification storage with SQLite."""

    def __init__(self, db_path: str = "data/memory/notifications.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(f"sqlite:///{self.db_path}", echo=False)
        Base.metadata.create_all(engine)
        self.Session = sessionmaker(bind=engine)

    def push(
        self,
        title: str,
        message: str,
        level: NotifLevel = NotifLevel.INFO,
        category: str = "system",
        workflow_id: Optional[str] = None,
        meta_data: Optional[Dict] = None,
    ) -> Dict:
        """Create and store a notification."""
        session = self.Session()
        try:
            record = NotificationRecord(
                workflow_id=workflow_id,
                level=level.value if isinstance(level, NotifLevel) else level,
                title=title,
                message=message,
                category=category,
                meta_data=json.dumps(meta_data) if meta_data else None,
            )
            session.add(record)
            session.commit()
            session.refresh(record)
            return self._to_dict(record)
        except Exception as e:
            session.rollback()
            logger.error(f"Failed to push notification: {e}")
            return {}
        finally:
            session.close()

    def get_all(self, limit: int = 100, unread_only: bool = False) -> List[Dict]:
        session = self.Session()
        try:
            q = session.query(NotificationRecord).order_by(NotificationRecord.created_at.desc())
            if unread_only:
                q = q.filter_by(read=False)
            return [self._to_dict(r) for r in q.limit(limit).all()]
        finally:
            session.close()

    def mark_read(self, notif_id: int) -> bool:
        session = self.Session()
        try:
            record = session.query(NotificationRecord).filter_by(id=notif_id).first()
            if record:
                record.read = True
                session.commit()
                return True
            return False
        except Exception:
            session.rollback()
            return False
        finally:
            session.close()

    def mark_all_read(self) -> int:
        session = self.Session()
        try:
            count = session.query(NotificationRecord).filter_by(read=False).update({"read": True})
            session.commit()
            return count
        except Exception:
            session.rollback()
            return 0
        finally:
            session.close()

    def delete(self, notif_id: int) -> bool:
        session = self.Session()
        try:
            record = session.query(NotificationRecord).filter_by(id=notif_id).first()
            if record:
                session.delete(record)
                session.commit()
                return True
            return False
        except Exception:
            session.rollback()
            return False
        finally:
            session.close()

    def clear_all(self) -> int:
        session = self.Session()
        try:
            count = session.query(NotificationRecord).count()
            session.query(NotificationRecord).delete()
            session.commit()
            return count
        except Exception:
            session.rollback()
            return 0
        finally:
            session.close()

    def unread_count(self) -> int:
        session = self.Session()
        try:
            return session.query(NotificationRecord).filter_by(read=False).count()
        finally:
            session.close()

    def _to_dict(self, r: NotificationRecord) -> Dict:
        return {
            "id": r.id,
            "workflow_id": r.workflow_id,
            "level": r.level,
            "title": r.title,
            "message": r.message,
            "category": r.category,
            "metadata": json.loads(r.meta_data) if r.meta_data else None,
            "read": r.read,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }

    # ── Convenience helpers called by orchestrator hooks ──
    def pipeline_started(self, workflow_id: str, goal: str):
        self.push(
            title="Pipeline Started",
            message=f'Workflow "{workflow_id[:12]}..." started for goal: {goal[:60]}',
            level=NotifLevel.INFO,
            category="pipeline",
            workflow_id=workflow_id,
        )

    def pipeline_success(self, workflow_id: str, score: float, episodes: int):
        self.push(
            title="Pipeline Completed",
            message=f"Goal achieved! Score: {score:.1f} in {episodes} episodes",
            level=NotifLevel.SUCCESS,
            category="pipeline",
            workflow_id=workflow_id,
            meta_data={"score": score, "episodes": episodes},
        )

    def pipeline_failed(self, workflow_id: str, error: str):
        self.push(
            title="Pipeline Failed",
            message=f"Error: {error[:100]}",
            level=NotifLevel.ERROR,
            category="pipeline",
            workflow_id=workflow_id,
            meta_data={"error": error},
        )

    def training_milestone(self, workflow_id: str, timestep: int, mean_reward: float):
        self.push(
            title="Training Milestone",
            message=f"Step {timestep:,} — Mean reward: {mean_reward:.2f}",
            level=NotifLevel.INFO,
            category="training",
            workflow_id=workflow_id,
        )


# Global singleton
notifications = NotificationService()
