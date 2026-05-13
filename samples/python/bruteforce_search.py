from itertools import combinations


def score_team(team):
    total = 0
    for player in team:
        total += player["attack"] * 2 + player["defense"]
    return total


def brute_force_combinatorial_search(players):
    best = None
    for team in combinations(players, 5):
        score = score_team(team)
        if best is None or score > best["score"]:
            best = {"team": team, "score": score}
    return best
