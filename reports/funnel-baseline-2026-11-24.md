# Funnel baseline before the dupe-first redesign (PR #180)

GA4 property scent-wise, **25 Oct – 23 Nov 2026** (last 30 days), all users, read on 24 Nov 2026
from Reports → Engagement → Events. Compare the same report for the 30 days after the deploy.

| Event | Events | Users |
|---|---:|---:|
| page_view | 1,787 | 683 |
| session_start | 793 | 683 |
| first_visit | 673 | 671 |
| form_start | 409 | 295 |
| ai_recommendation | 336 | 188 |
| paywall_shown | 77 | 53 |
| affiliate_click | 60 | 33 |
| email_captured | 15 | 14 |
| begin_checkout | 3 | 3 |
| purchase | 2 | 2 (revenue $20.80) |
| Total users | | 685 |

`hero_search` did not exist before this PR, so there is no baseline for it.

## Rates (users unless noted)

| Step | Baseline |
|---|---:|
| Visitor → got an AI pick (ai_recommendation ÷ users) | 188 / 685 = **27.4%** |
| Pick → Shop click (affiliate_click events ÷ ai_recommendation events, all surfaces) | 60 / 336 = **17.9%** |
| Shop clickers among all users | 33 / 685 = **4.8%** |
| Hit the paywall | 53 / 685 = **7.7%** |
| Paywall → checkout started | 3 / 53 = **5.7%** |
| Paywall → purchase | 2 / 53 = **3.8%** |
| Email captured among AI users | 14 / 188 = **7.4%** |

Caveat: affiliate_click here counts every surface (explore, celebs, blog, advisor). After the deploy,
also filter it by `surface = advisor` for the pick → Shop rate. Amazon orders come from the
Associates report per store, not GA4.
