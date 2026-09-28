import random
import pytest

from tools.checks import assert_clean


def _oracle(leaderboard, min_score=0.0):
    best_candidate = None
    best_key = None

    for model in leaderboard:
        score = float(model.get("score", 0.0))
        if score < min_score:
            continue

        inp_tokens = int(model.get("input_tokens", 0))
        out_tokens = int(model.get("output_tokens", 0))
        inp_price = float(model.get("input_cost_per_m", 0.0))
        out_price = float(model.get("output_cost_per_m", 0.0))

        cost = (inp_tokens * inp_price + out_tokens * out_price) / 1_000_000.0
        if cost <= 0.0:
            continue

        eff = score / cost
        key = (eff, score)
        if best_key is None or key > best_key:
            best_key = key
            best_candidate = model

    return best_candidate["name"] if best_candidate is not None else None


def test_empty_leaderboard(impl):
    assert impl.best_value_model([]) is None
    assert impl.best_value_model([], min_score=10.0) is None


def test_basic_selection(impl):
    board = [
        {
            "name": "Frontier-X",
            "score": 45.0,
            "input_tokens": 10_000_000,
            "output_tokens": 2_000_000,
            "input_cost_per_m": 3.0,
            "output_cost_per_m": 15.0,
        },
        {
            "name": "Fast-Coder",
            "score": 40.0,
            "input_tokens": 8_000_000,
            "output_tokens": 1_500_000,
            "input_cost_per_m": 0.5,
            "output_cost_per_m": 1.5,
        },
        {
            "name": "Mini-Agent",
            "score": 10.0,
            "input_tokens": 5_000_000,
            "output_tokens": 1_000_000,
            "input_cost_per_m": 0.2,
            "output_cost_per_m": 0.8,
        },
    ]
    # Frontier-X cost = (10*3 + 2*15) = 60.0 USD, eff = 45 / 60 = 0.75
    # Fast-Coder cost = (8*0.5 + 1.5*1.5) = 6.25 USD, eff = 40 / 6.25 = 6.4
    # Mini-Agent cost = (5*0.2 + 1*0.8) = 1.8 USD, eff = 10 / 1.8 = 5.56
    assert impl.best_value_model(board) == "Fast-Coder"


def test_min_score_filter(impl):
    board = [
        {
            "name": "Cheap-Toy",
            "score": 2.0,
            "input_tokens": 100_000,
            "output_tokens": 10_000,
            "input_cost_per_m": 0.1,
            "output_cost_per_m": 0.2,
        },
        {
            "name": "Capable-Workhorse",
            "score": 50.0,
            "input_tokens": 5_000_000,
            "output_tokens": 1_000_000,
            "input_cost_per_m": 1.0,
            "output_cost_per_m": 3.0,
        },
    ]
    # Cheap-Toy cost = (0.1*0.1 + 0.01*0.2) = 0.012 USD, eff = 2.0 / 0.012 = 166.67
    # Capable-Workhorse cost = (5*1 + 1*3) = 8.0 USD, eff = 50.0 / 8.0 = 6.25
    assert impl.best_value_model(board, min_score=0.0) == "Cheap-Toy"
    assert impl.best_value_model(board, min_score=20.0) == "Capable-Workhorse"
    assert impl.best_value_model(board, min_score=60.0) is None


def test_tie_breaking_higher_score(impl):
    # Two models with exact same efficiency:
    # Model A: score 10, cost $2.0 -> eff 5.0
    # Model B: score 20, cost $4.0 -> eff 5.0
    model_a = {
        "name": "Model-A",
        "score": 10.0,
        "input_tokens": 2_000_000,
        "output_tokens": 0,
        "input_cost_per_m": 1.0,
        "output_cost_per_m": 0.0,
    }
    model_b = {
        "name": "Model-B",
        "score": 20.0,
        "input_tokens": 4_000_000,
        "output_tokens": 0,
        "input_cost_per_m": 1.0,
        "output_cost_per_m": 0.0,
    }
    assert impl.best_value_model([model_a, model_b]) == "Model-B"
    assert impl.best_value_model([model_b, model_a]) == "Model-B"


def test_tie_breaking_order(impl):
    # Two models with identical efficiency and identical score:
    # First in the list wins
    m1 = {
        "name": "First-Instance",
        "score": 30.0,
        "input_tokens": 1_000_000,
        "output_tokens": 500_000,
        "input_cost_per_m": 2.0,
        "output_cost_per_m": 4.0,
    }
    m2 = {
        "name": "Second-Instance",
        "score": 30.0,
        "input_tokens": 1_000_000,
        "output_tokens": 500_000,
        "input_cost_per_m": 2.0,
        "output_cost_per_m": 4.0,
    }
    assert impl.best_value_model([m1, m2]) == "First-Instance"
    assert impl.best_value_model([m2, m1]) == "Second-Instance"


def test_zero_and_negative_cost_ignored(impl):
    board = [
        {
            "name": "Free-Model-Zero-Tokens",
            "score": 80.0,
            "input_tokens": 0,
            "output_tokens": 0,
            "input_cost_per_m": 0.0,
            "output_cost_per_m": 0.0,
        },
        {
            "name": "Negative-Cost-Bug",
            "score": 90.0,
            "input_tokens": 1_000_000,
            "output_tokens": 100_000,
            "input_cost_per_m": -1.0,
            "output_cost_per_m": 0.0,
        },
        {
            "name": "Legit-Model",
            "score": 35.0,
            "input_tokens": 2_000_000,
            "output_tokens": 500_000,
            "input_cost_per_m": 1.0,
            "output_cost_per_m": 2.0,
        },
    ]
    assert impl.best_value_model(board) == "Legit-Model"
    # If all models have non-positive cost, return None
    assert impl.best_value_model(board[:2]) is None


def test_zero_score_eligible(impl):
    board = [
        {
            "name": "Failing-Model",
            "score": 0.0,
            "input_tokens": 1_000_000,
            "output_tokens": 100_000,
            "input_cost_per_m": 1.0,
            "output_cost_per_m": 2.0,
        }
    ]
    # score 0.0 >= min_score 0.0 -> returns the model (eff = 0.0)
    assert impl.best_value_model(board, min_score=0.0) == "Failing-Model"
    assert impl.best_value_model(board, min_score=0.1) is None


def test_programbench_leaderboard(impl):
    # Realistic models evaluated on ProgramBench benchmark
    board = [
        {
            "name": "Claude Opus 5 (xhigh)",
            "score": 4.5,
            "input_tokens": 20_000_000,
            "output_tokens": 4_000_000,
            "input_cost_per_m": 15.0,
            "output_cost_per_m": 75.0,
        },
        {
            "name": "GPT-5.6 Sol",
            "score": 1.0,
            "input_tokens": 15_000_000,
            "output_tokens": 3_000_000,
            "input_cost_per_m": 10.0,
            "output_cost_per_m": 50.0,
        },
        {
            "name": "Claude 3.5 Sonnet",
            "score": 3.8,
            "input_tokens": 18_000_000,
            "output_tokens": 3_500_000,
            "input_cost_per_m": 3.0,
            "output_cost_per_m": 15.0,
        },
        {
            "name": "DeepSeek-V3",
            "score": 2.5,
            "input_tokens": 15_000_000,
            "output_tokens": 3_000_000,
            "input_cost_per_m": 0.14,
            "output_cost_per_m": 0.28,
        },
    ]
    # Claude Opus 5: cost = 20*15 + 4*75 = 600.0, eff = 4.5 / 600 = 0.0075
    # GPT-5.6 Sol:   cost = 15*10 + 3*50 = 300.0, eff = 1.0 / 300 = 0.0033
    # Claude 3.5:    cost = 18*3 + 3.5*15 = 106.5, eff = 3.8 / 106.5 = 0.0357
    # DeepSeek-V3:   cost = 15*0.14 + 3*0.28 = 2.94, eff = 2.5 / 2.94 = 0.8503
    assert impl.best_value_model(board) == "DeepSeek-V3"
    # Even if min_score requires at least 3.0% solve rate:
    assert impl.best_value_model(board, min_score=3.0) == "Claude 3.5 Sonnet"


def test_fuzz_random_against_oracle(impl):
    rng = random.Random(42)
    names = [f"Model-{i}" for i in range(1, 15)]

    for _ in range(50):
        k = rng.randint(0, 8)
        selected_names = rng.sample(names, k) if k <= len(names) else names
        board = []
        for name in selected_names:
            board.append({
                "name": name,
                "score": round(rng.uniform(0.0, 100.0), 2),
                "input_tokens": rng.randint(0, 50_000_000),
                "output_tokens": rng.randint(0, 10_000_000),
                "input_cost_per_m": round(rng.uniform(0.1, 20.0), 2),
                "output_cost_per_m": round(rng.uniform(0.2, 80.0), 2),
            })
        min_score = round(rng.uniform(0.0, 50.0), 1) if rng.random() > 0.3 else 0.0
        expected = _oracle(board, min_score)
        actual = impl.best_value_model(board, min_score)
        assert actual == expected


def test_no_banned_constructs(impl_source, banned):
    assert_clean(impl_source, banned)
