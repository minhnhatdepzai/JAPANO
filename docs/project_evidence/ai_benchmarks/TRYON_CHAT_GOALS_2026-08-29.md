# Try-on, chatbot and goals regression evidence — 2026-08-29

Hardware for try-on smoke tests: NVIDIA GeForce RTX 5060 Ti 16 GB. Backend,
body worker and FASHN service were local. The image is the public Guinness World
Records photo linked below; no private user image is stored in this evidence.

## Body analysis and try-on

Source: [Guinness World Records — Nepalese teen confirmed as shortest in the world](https://www.guinnessworldrecords.com/news/2022/5/nepalese-teen-confirmed-as-shortest-in-the-world-705929).
The page reports 73.43 cm, but that label was not sent as a measurement or used
to override the body model.

| Case | Body result | Try-on result | End-to-end |
|---|---|---|---:|
| Original public image + `yukata-xanh` XL | `insufficient_evidence`; head/body cue outside calibrated domain | HTTP 200, real FASHN image, no overlay fallback | 37.865 s |
| Same image padded to make the subject small and force pose transfer | same truth contract | HTTP 200, real image, `poseTransferred=true`, explicit identity/t proportion warning | 61.893 s |

The prior 503 took about 137 seconds even though the GPU had produced an image.
Its hard identity gate compared the original pose with a deliberately re-posed
result, so face/body geometry changes were inevitable. The fix retains person,
garment, pose and coverage gates; only pixel-identity checks become a visible
warning when pose transfer was required. Suitable source poses remain strict.

## Chatbot and goals

Live endpoint smoke tests returned catalog-grounded answers for:

- `shop có quần áo gì vậy?`
- `toi muon mua do mau xanh di le hoi duoi 2 trieu`
- `Yukata xanh còn size gì?`

Regression tests also cover a follow-up `cái đó giá bao nhiêu?`, actual in-stock
sizes, removal of unhelpful Ollama refusals, health/shopping topic separation,
invalid anthropometric input and the under-18 safety path.

External-data decisions and license observations are in
`backend/ai_training/chatbot_dataset/provenance/DATASET_SURVEY.md`. This work is
grounding/rule/evaluation tuning. It is not a chatbot or wellness fine-tune and
does not create a checkpoint.

## Validation

- `npm run check`: 284 Node tests, mobile TypeScript, 97 Python tests; 2 Python
  tests skipped by their existing synthetic-mask condition.
- Expo public config resolves the new native splash asset and Android package
  `vn.japano.app`.
- No ADB device was connected, so the brand animation and these flows were not
  visually re-verified on the OPPO in this session.

