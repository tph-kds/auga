"""
Memory System: SQLite-based persistent storage for plans, experiments, and logs.
Implements structured memory for tracking training history and best configurations.
"""
import sqlite3
import json
import pickle
from typing import Dict, List, Optional, Any
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


class MemorySystem:
    """
    Central memory system using SQLite for persistence.
    Stores: training plans, experiments, models, metrics, logs.
    """

    def __init__(self, db_path: str = "data/memory/memory.db"):
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        self._init_database()
        self._ensure_tables()

    def _init_database(self):
        """Initialize database connection."""
        self.conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    def _ensure_tables(self):
        """Create all required tables if they don't exist."""
        tables = [
            """
            CREATE TABLE IF NOT EXISTS plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                goal TEXT NOT NULL,
                target_value REAL,
                game_type TEXT,
                algorithm TEXT,
                total_timesteps INTEGER,
                reward_strategy TEXT,
                success_criteria TEXT,
                constraints TEXT,
                hyperparameters TEXT,
                raw_input TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'pending'
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS experiments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER,
                model_path TEXT,
                training_metrics TEXT,
                evaluation_results TEXT,
                success BOOLEAN,
                episodes INTEGER,
                final_score REAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(plan_id) REFERENCES plans(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS model_registry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT UNIQUE,
                model_path TEXT NOT NULL,
                algorithm TEXT,
                environment TEXT,
                metrics TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                tags TEXT
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                level TEXT,
                message TEXT,
                source TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS performance_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                experiment_id INTEGER,
                score REAL,
                reward REAL,
                steps INTEGER,
                success BOOLEAN,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(experiment_id) REFERENCES experiments(id)
            )
            """,
            """
            CREATE TABLE IF NOT EXISTS hyperparam_trials (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_id INTEGER,
                hyperparameters TEXT,
                performance_metric REAL,
                success BOOLEAN,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(plan_id) REFERENCES plans(id)
            )
            """
        ]

        for table_sql in tables:
            self.cursor.execute(table_sql)

        self.conn.commit()

    def store_plan(self, plan) -> int:
        """Store a training plan and return its ID."""
        if is_dataclass(plan):
            plan_dict = asdict(plan)
        else:
            plan_dict = plan

        sql = """
        INSERT INTO plans (
            goal, target_value, game_type, algorithm, total_timesteps,
            reward_strategy, success_criteria, constraints, hyperparameters,
            raw_input
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        params = (
            plan_dict.get('goal'),
            plan_dict.get('target_value'),
            plan_dict.get('game_type'),
            plan_dict.get('algorithm'),
            plan_dict.get('total_timesteps'),
            plan_dict.get('reward_strategy'),
            plan_dict.get('success_criteria'),
            json.dumps(plan_dict.get('constraints', [])),
            json.dumps(plan_dict.get('hyperparameters', {})),
            plan_dict.get('raw_input')
        )

        self.cursor.execute(sql, params)
        self.conn.commit()

        plan_id = self.cursor.lastrowid
        logger.info(f"Stored plan with ID {plan_id}")

        # Log action
        self.log("INFO", f"Stored plan: {plan_dict.get('goal')}", "memory")

        return plan_id

    def get_plan(self, plan_id: int) -> Optional[Dict]:
        """Retrieve a training plan by ID."""
        self.cursor.execute("SELECT * FROM plans WHERE id = ?", (plan_id,))
        row = self.cursor.fetchone()

        if row:
            return self._row_to_dict(row)
        return None

    def get_recent_plans(self, limit: int = 10) -> List[Dict]:
        """Get recent training plans."""
        self.cursor.execute(
            "SELECT * FROM plans ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        rows = self.cursor.fetchall()
        return [self._row_to_dict(row) for row in rows]

    def store_experiment(self,
                        plan_id: int,
                        model_path: str,
                        training_metrics: Dict,
                        evaluation_results: Dict,
                        success: bool,
                        episodes: int,
                        final_score: float) -> int:
        """Store experiment results."""
        sql = """
        INSERT INTO experiments (
            plan_id, model_path, training_metrics, evaluation_results,
            success, episodes, final_score
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """

        params = (
            plan_id,
            model_path,
            json.dumps(training_metrics),
            json.dumps(evaluation_results),
            success,
            episodes,
            final_score
        )

        self.cursor.execute(sql, params)
        self.conn.commit()

        experiment_id = self.cursor.lastrowid

        # Store performance history
        if evaluation_results:
            self._store_performance_history(
                experiment_id,
                evaluation_results
            )

        return experiment_id

    def _store_performance_history(self,
                                  experiment_id: int,
                                  evaluation_results: Dict):
        """Store evaluation results into performance history."""
        sql = """
        INSERT INTO performance_history (experiment_id, score, reward, steps, success)
        VALUES (?, ?, ?, ?, ?)
        """

        params = (
            experiment_id,
            evaluation_results.get('mean_score', 0),
            evaluation_results.get('mean_reward', 0),
            evaluation_results.get('mean_length', 0),
            evaluation_results.get('success_rate', 0) > 0.5
        )

        self.cursor.execute(sql, params)
        self.conn.commit()

    def register_model(self,
                      model_name: str,
                      model_path: str,
                      algorithm: str,
                      environment: str,
                      metrics: Dict,
                      tags: Optional[List[str]] = None):
        """Register a trained model in the registry."""
        sql = """
        INSERT OR REPLACE INTO model_registry
        (model_name, model_path, algorithm, environment, metrics, tags)
        VALUES (?, ?, ?, ?, ?, ?)
        """

        params = (
            model_name,
            model_path,
            algorithm,
            environment,
            json.dumps(metrics),
            json.dumps(tags or [])
        )

        self.cursor.execute(sql, params)
        self.conn.commit()

        self.log("INFO", f"Registered model: {model_name}", "memory")

    def get_models(self) -> List[Dict]:
        """Get list of registered models."""
        self.cursor.execute("SELECT * FROM model_registry ORDER BY created_at DESC")
        rows = self.cursor.fetchall()
        return [self._row_to_dict(row) for row in rows]

    def get_model(self, model_name: str) -> Optional[Dict]:
        """Get model info by name."""
        self.cursor.execute("SELECT * FROM model_registry WHERE model_name = ?", (model_name,))
        row = self.cursor.fetchone()
        if row:
            return self._row_to_dict(row)
        return None

    def log(self, level: str, message: str, source: str = "system"):
        """Store a log entry in the database."""
        sql = """
        INSERT INTO logs (level, message, source)
        VALUES (?, ?, ?)
        """
        self.cursor.execute(sql, (level, message, source))
        self.conn.commit()

    def get_logs(self, limit: int = 100) -> List[Dict]:
        """Retrieve recent log entries."""
        self.cursor.execute(
            "SELECT * FROM logs ORDER BY timestamp DESC LIMIT ?",
            (limit,)
        )
        rows = self.cursor.fetchall()
        return [self._row_to_dict(row) for row in rows]

    def _row_to_dict(self, row) -> Dict:
        """Convert sqlite row to dictionary."""
        result = dict(row)

        # Parse JSON fields
        json_fields = ['constraints', 'hyperparameters', 'training_metrics',
                       'evaluation_results', 'metrics', 'tags']
        for field in json_fields:
            if field in result and result[field]:
                try:
                    result[field] = json.loads(result[field])
                except json.JSONDecodeError:
                    pass

        return result

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()

    def __del__(self):
        self.close()
