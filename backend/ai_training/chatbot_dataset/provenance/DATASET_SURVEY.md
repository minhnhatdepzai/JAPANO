# Chatbot and wellness data survey — 2026-08-29

The runtime fixes in this repository are catalog grounding and deterministic
safety rules, not a claimed model fine-tune. No external record is copied into
MongoDB or production prompts by this survey.

| Source | What it contains | License shown by source | Decision |
|---|---|---|---|
| [U-NEED](https://github.com/LeeeeoLiu/U-NEED) | 7,698 annotated pre-sales dialogues, user behaviours and product knowledge tuples | MIT repository license; dataset access has its own application instructions | Hold for schema study and offline intent/retrieval evaluation. Chinese marketplace text must not become Vietnamese production answers without translation review. |
| [Fashion Product Images (Small)](https://www.kaggle.com/datasets/paramaggarwal/fashion-product-images-small) | 44k fashion images and category/style metadata | MIT on Kaggle page | Approved for offline vocabulary/image-retrieval experiments. It does not contain reliable conversations, prices or JAPANO inventory. |
| [Fashion-MNIST Product Descriptions](https://www.kaggle.com/datasets/aguado/fashion-mnist-product-descriptions) | Synthetic descriptions for Fashion-MNIST | CC0 on Kaggle page | Optional lexical augmentation only. Synthetic text must not be treated as product truth. |
| [WHO physical activity guideline](https://www.who.int/publications/i/item/9789240015128) | Evidence-based activity recommendations by age/population | WHO publication terms | Approved as the rule/provenance source; not a dialogue fine-tune dataset. |
| [CDC Steps for Losing Weight](https://www.cdc.gov/healthy-weight-growth/losing-weight/index.html) | Gradual weight-loss and behavior guidance | US government source | Approved as the rule/provenance source; no calorie prescription is generated. |

## Training gate

Before any external fine-tune, create a manifest with the exact downloaded
revision, file hashes, license text, intended fields, PII review, language review
and train/dev/test split. A successful run must save a reloadable adapter or
checkpoint with hash and beat the local grounded baseline on a disjoint
Vietnamese evaluation set. Until then, describe the work as retrieval/prompt/
rule tuning.

## Current evaluation coverage

`backend/test/chatbot-goals-grounding.test.js` locks common Vietnamese commerce
queries, no-accent input, live price/size grounding, conversational references,
unhelpful LLM refusal fallback, goal-topic separation and wellness input safety.
Add every reproduced user failure to that file before changing a model.

