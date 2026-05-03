def _parse_with_llm(self, user_input: str):
    """Parse with LLM."""
    system_prompt = """
You are RL planning expert. Parse user goal to JSON with these exact keys:
- goal: string like 'maximize_score'
- target_value: number e.g. 200.0
- game_type: 'CartPole-v1', 'AngryBird-v0' etc.
- algorithm: 'PPO', 'A2C', 'DQN'
- total_timesteps: int 50000-500000
- reward_strategy: string 'score_based'
- success_criteria: string 'Achieve score 200'
- hyperparameters: {} dict
Use smart defaults. No extra fields.
"""
    prompt = f"{system_prompt}\nUser goal: {user_input}\nJSON:"
    response = self.llm.invoke(prompt)
    import json
    plan_dict = json.loads(response.strip('```json\n').strip('```'))
    return plan_dict

def _parse_rule_based(self, user_input: str) -> 'TrainingPlan':
    \"\"\"Rule-based fallback.\"\"\"
    # Existing rule code here - placeholder
    return TrainingPlan(
        goal='maximize_score',
        target_value=100.0,
        game_type=GameType.CARTPOLE,
        algorithm=Algorithm.PPO,
        total_timesteps=100000,
        reward_strategy='default',
        success_criteria='Achieve score 100'
    )

