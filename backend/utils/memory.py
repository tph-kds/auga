"""
Memory System: SQLite-based persistent storage for plans, experiments, and logs.
Implements structured memory for tracking training history and best configurations.
"""
import sqlite3
import json
import pickle
from typing import Dict, List, Optional, Any
"""Compatibility wrapper for memory system."""
from backend.services.memory import MemorySystem

__all__ = ["MemorySystem"]
            success
        )

        self.cursor.execute(sql, params)
        self.conn.commit()

    def get_best_hyperparams(self, plan_id: int) -> Optional[Dict]:
        """Get best hyperparameters for a plan based on performance."""
        self.cursor.execute(
            """
            SELECT hyperparameters, performance_metric
            FROM hyperparam_trials
            WHERE plan_id = ? AND success = 1
            ORDER BY performance_metric DESC
            LIMIT 1
            """,
            (plan_id,)
        )
        row = self.cursor.fetchone()

        if row:
            return {
                'hyperparameters': json.loads(row['hyperparameters']),
                'performance': row['performance_metric']
            }
        return None

    def _row_to_dict(self, row: sqlite3.Row) -> Dict:
        """Convert sqlite3.Row to dictionary."""
        return dict(row)

    def close(self):
        """Close database connection."""
        if hasattr(self, 'conn'):
            self.conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


# Global memory instance
memory_system = MemorySystem()
