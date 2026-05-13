import random


def estimate_pi(samples):
    inside = 0
    for _ in range(samples):
        x = random.random()
        y = random.random()
        if x * x + y * y <= 1:
            inside += 1
    return inside / samples * 4
