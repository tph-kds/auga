"""
Test runner for the entire system.
Run all tests or specific modules.
"""
import sys
import subprocess
import os


def run_tests(test_type="all"):
    """Run test suite."""
    project_root = os.path.dirname(os.path.abspath(__file__))
    test_dir = os.path.join(project_root, "tests")

    if test_type == "all":
        cmd = ["pytest", test_dir, "-v", "--tb=short"]
    elif test_type == "agents":
        cmd = ["pytest", os.path.join(test_dir, "test_agents.py"), "-v"]
    elif test_type == "rl":
        cmd = ["pytest", os.path.join(test_dir, "test_rl.py"), "-v"]
    else:
        print(f"Unknown test type: {test_type}")
        return 1

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=project_root)
    return result.returncode


def run_demo():
    """Run the demo script."""
    demo_path = os.path.join(os.path.dirname(__file__), "demo.py")
    subprocess.run([sys.executable, demo_path])


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Test runner for RL Agent System")
    parser.add_argument("--all", action="store_true", help="Run all tests")
    parser.add_argument("--agents", action="store_true", help="Run agent tests only")
    parser.add_argument("--rl", action="store_true", help="Run RL tests only")
    parser.add_argument("--demo", action="store_true", help="Run demo script")

    args = parser.parse_args()

    if args.demo:
        run_demo()
    elif args.agents:
        sys.exit(run_tests("agents"))
    elif args.rl:
        sys.exit(run_tests("rl"))
    else:
        sys.exit(run_tests("all"))
