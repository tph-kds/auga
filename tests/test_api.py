"""
Tests for FastAPI backend.
"""
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)


class TestAPI:
    """API endpoint tests."""

    def test_root(self):
        """Test root endpoint returns API info."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "name" in data
        assert "endpoints" in data

    def test_health(self):
        """Test health check."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"

    def test_get_tools(self):
        """Test tools listing."""
        response = client.get("/tools")
        assert response.status_code == 200
        data = response.json()
        assert "tools" in data
        assert len(data["tools"]) > 0

    def test_train_endpoint(self):
        """Test training endpoint (quick)."""
        response = client.post("/train", json={
            "environment": "CartPole-v1",
            "algorithm": "PPO",
            "total_timesteps": 1000
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "model_path" in data

    def test_evaluate_endpoint(self):
        """Test evaluation endpoint."""
        response = client.post("/evaluate", json={
            "n_episodes": 2
        })
        # May fail if no model trained yet, but endpoint should work
        assert response.status_code in [200, 400]  # Either success or no model error

    def test_play_endpoint(self):
        """Test runtime play endpoint."""
        response = client.post("/play", json={
            "target": 10.0,
            "max_episodes": 10
        })
        assert response.status_code == 200
        data = response.json()
        assert "success" in data

    def test_execute_tool(self):
        """Test tool execution."""
        response = client.post("/tools/execute", json={
            "name": "get_status",
            "arguments": {}
        })
        assert response.status_code == 200
        data = response.json()
        assert "result" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
