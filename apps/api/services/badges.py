"""Derived achievement badges.

Badges are computed on read from values the caller already has (streak, lifetime
counts, average quiz score) — there is no badge storage and no migration. Each
badge is a stable string key; the frontend maps keys to labels/icons. Keep keys
stable: changing one silently retires every user's earned badge.
"""


def compute_badges(
    *,
    streak: int = 0,
    total_summaries: int = 0,
    total_quizzes: int = 0,
    total_documents: int = 0,
    total_chats: int = 0,
    average_quiz_score: float = 0.0,
) -> list[str]:
    """Return the achievement keys a user has earned, highest tier first per family.

    All inputs are keyword-only so call sites read self-documentingly and adding a
    future input never shifts a positional argument. Tiered families (streak,
    summaries, …) return only the single highest tier reached, so the UI shows one
    badge per family rather than the whole ladder.
    """
    badges: list[str] = []

    def _tier(value: int, thresholds: tuple[tuple[int, str], ...]) -> None:
        # thresholds: ascending (min_value, key); append only the highest reached.
        earned: str | None = None
        for minimum, key in thresholds:
            if value >= minimum:
                earned = key
        if earned:
            badges.append(earned)

    _tier(streak, ((3, "streak_3"), (7, "streak_7"), (30, "streak_30"), (100, "streak_100")))
    _tier(total_summaries, ((10, "summaries_10"), (50, "summaries_50"), (100, "summaries_100")))
    _tier(total_quizzes, ((10, "quizzes_10"), (50, "quizzes_50"), (100, "quizzes_100")))
    _tier(total_documents, ((5, "documents_5"), (25, "documents_25"), (100, "documents_100")))
    _tier(total_chats, ((25, "chats_25"), (100, "chats_100"), (500, "chats_500")))

    # Quiz-mastery badge: a high average across a meaningful number of quizzes.
    if total_quizzes >= 5 and average_quiz_score >= 90.0:
        badges.append("quiz_ace")

    return badges
