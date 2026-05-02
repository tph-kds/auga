#!/usr/bin/env python3
"""
Verification script - checks if all system components are properly installed.
"""
import sys
import importlib

def check_imports():
    """Check that all modules can be imported."""
    modules = [
        'gymnasium',
        'stable_baselines3',
        'fastapi',
        'uvicorn',
        'sqlite3',
        'docker',
        'pygame',
        'numpy'
    ]

    results = {}
    for module in modules:
        try:
            importlib.import_module(module)
            results[module] = "✅ OK"
        except ImportError as e:
            results[module] = f"❌ MISSING: {e}"

    return results

def check_files():
    """Check that critical files exist."""
    from pathlib import Path
    base = Path(__file__).parent

    critical_files = [
        'backend/agents/planner.py',
        'backend/agents/reward_generator.py',
        'backend/rl/trainer.py',
        'backend/rl/environments.py',
        'backend/runtime/controller.py',
        'backend/workflows/orchestration.py',
        'backend/api/main.py',
        'backend/utils/tools.py',
        'backend/utils/memory.py',
        'backend/utils/validation.py',
        'backend/utils/sandbox.py',
        'config.py',
        'requirements.txt',
        'README.md'
    ]

    results = {}
    for file in critical_files:
        path = base / file
        results[file] = "✅ OK" if path.exists() else "❌ MISSING"

    return results

def main():
    print("=" * 60)
    print("Autonomous RL Agent System - Verification")
    print("=" * 60)

    print("\n📦 Checking Python dependencies...")
    imports = check_imports()
    for module, status in imports.items():
        print(f"  {module}: {status}")

    print("\n📁 Checking project files...")
    files = check_files()
    for file, status in files.items():
        print(f"  {file}: {status}")

    print("\n" + "=" * 60)

    # Summary
    all_ok = all("OK" in v for v in list(imports.values()) + list(files.values()))
    if all_ok:
        print("✅ All checks passed! System ready.")
        print("\nNext steps:")
        print("  1. python -m backend.api.main  # Start API")
        print("  2. python demo.py              # Run demo")
        print("  3. python runtests.py --all    # Run tests")
        return 0
    else:
        print("⚠️  Some checks failed. See above.")
        return 1

if __name__ == '__main__':
    sys.exit(main())
