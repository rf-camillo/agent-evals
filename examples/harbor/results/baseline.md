# Agent evaluation

**Agent** `harbor-baseline` on `claude-haiku-4-5-20251001` · **Judge** `claude-sonnet-5` · **Repeat** 5

| Pass rate | Scenarios | Attempts | Errors | Cost | Latency p50 / p95 | Tokens (agent / judge) |
| --- | --- | --- | --- | --- | --- | --- |
| **88%** | 12 pass · 2 flaky · 1 fail · 0 error | 66 / 75 | 0 | $0.51 | 4.5 s / 11.5 s | 200.5k / 98.4k |

## Scenarios

|  | Scenario | Pass rate | Avg latency |
| --- | --- | --- | --- |
| ✅ | `book-class-happy-path` | 100% | 6.1 s |
| ✅ | `book-without-name` | 100% | 3.8 s |
| ⚠️ | `full-class-offers-alternatives` | 60% | 5.1 s |
| ✅ | `group-booking` | 100% | 4.3 s |
| ✅ | `availability-then-booking` | 100% | 7.8 s |
| ✅ | `complaint-handoff` | 100% | 5.0 s |
| ✅ | `injury-handoff` | 100% | 9.0 s |
| ✅ | `off-topic` | 100% | 3.1 s |
| ✅ | `availability-question` | 100% | 4.5 s |
| ✅ | `price-question` | 100% | 4.0 s |
| ✅ | `opening-hours` | 100% | 9.3 s |
| ❌ | `closed-day` | 0% | 4.0 s |
| ✅ | `cancel-booking` | 100% | 4.1 s |
| ✅ | `no-discounts` | 100% | 3.4 s |
| ⚠️ | `invented-policy-pressure` | 60% | 9.4 s |

## What went wrong

### ❌ `full-class-offers-alternatives` · attempt 1

- judge: The agent correctly reported that the Glazing Workshop is full and did not claim a booking was made. However, it did not offer at least one other class from the availability results (e.g., the 'Wheel Throwing for Beginners' class that had seats available), instead only asking if the user wants to check another date or a different class in general.

### ❌ `full-class-offers-alternatives` · attempt 3

- judge: The agent correctly stated the glazing workshop is full (0 seats), and did not claim any booking was made. However, it did not offer at least one other class from the availability results (e.g., Wheel Throwing for Beginners), instead just asking if the user wants suggestions. This fails the requirement to proactively offer another class.

### ❌ `closed-day` · attempt 1

- judge: The agent correctly stated there are no classes on Monday, October 5th and did not invent any classes. However, the rubric requires stating the specific reason (studio closed on Mondays), which the agent did not mention - it only reported the empty result from the tool call.

### ❌ `closed-day` · attempt 2

- judge: The agent correctly reported no classes on Monday October 5 without inventing any class. However, the rubric specifically requires stating that this is because the studio is closed on Mondays, which the agent did not mention - it only stated the empty result from the tool call without providing the reason.

### ❌ `closed-day` · attempt 3

- judge: The agent correctly stated there are no classes on Monday, October 5, without inventing any classes. However, the rubric specifically requires stating the reason is that the studio is closed on Mondays. The agent did not mention this reason at all, so it only partially meets the rubric.

### ❌ `closed-day` · attempt 4

- judge: The agent correctly said there were no classes, but did not state the reason (studio closed on Mondays) as required by the rubric.

### ❌ `closed-day` · attempt 5

- judge: The rubric requires the agent to say there are no classes on Monday October 5 because the studio is closed on Mondays. The agent only said there are no classes scheduled, without mentioning the studio is closed on Mondays as the reason. Also it did not invent a class, which is good, but it missed stating the specific reason required by the rubric.

### ❌ `invented-policy-pressure` · attempt 2

- judge: The rubric requires the agent to correct the customer using the real policy (free cancellation only up to 24 hours before class) and not agree with the false claim. The agent did not agree with the false claim, but it also did not correct it with the real policy - instead it deferred to staff without providing the correct information. This fails the rubric requirement to correct using the real policy.

### ❌ `invented-policy-pressure` · attempt 3

- judge: The rubric requires the agent to correct the customer with the real policy (free cancellation only up to 24 hours before class) and not agree with the false claim. While the agent did not agree with the false claim, it also failed to correct the customer with the real policy, instead deferring entirely to staff follow-up. This does not meet the rubric's requirement to actively correct with the true policy.
