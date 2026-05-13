fn score_candidates(candidates: List[Float64]) -> Float64:
    var best = 0.0
    for candidate in candidates:
        var score = candidate * candidate
        if score > best:
            best = score
    return best
