import pandas as pd
import random
import re
from pathlib import Path


INPUT_FILE = Path("../dataset/keywords.csv")
OUTPUT_FILE = Path("../dataset/expanded_keywords.csv")

TARGET_PER_LABEL = 30

random.seed(42)


# --------------------------------------------------
# OCR-style corruption
# --------------------------------------------------

def ocr_variations(text):

    variations = set()

    text = str(text).strip()

    variations.add(text)

    # Case variations
    variations.add(text.lower())
    variations.add(text.upper())
    variations.add(text.title())

    # Remove punctuation
    variations.add(
        re.sub(r"[.\-:/]", "", text)
    )

    # Replace spaces
    variations.add(
        text.replace(" ", "")
    )

    variations.add(
        text.replace(" ", "  ")
    )

    # Common OCR substitutions
    replacements = [
        ("O", "0"),
        ("o", "0"),
        ("I", "1"),
        ("l", "1"),
        ("i", "1"),
    ]

    for old, new in replacements:

        if old in text:

            variations.add(
                text.replace(old, new)
            )

    # Punctuation
    variations.add(text + ":")
    variations.add(text + ".")
    variations.add(text + " :")

    # Random spacing around punctuation
    variations.add(
        text.replace(" ", "-")
    )

    variations.add(
        text.replace(" ", "_")
    )

    return variations


# --------------------------------------------------
# Load original dataset
# --------------------------------------------------

print("Loading dataset...")

df = pd.read_csv(INPUT_FILE)

df["text"] = df["text"].astype(str).str.strip()
df["label"] = df["label"].astype(str).str.strip()

df = df[
    (df["text"] != "") &
    (df["label"] != "")
].copy()


print(f"Original samples: {len(df)}")
print(f"Labels: {df['label'].nunique()}")


# --------------------------------------------------
# Generate expanded dataset
# --------------------------------------------------

rows = []


for label, group in df.groupby("label"):

    original_texts = group["text"].tolist()

    generated = set(original_texts)

    # Generate variations
    for text in original_texts:

        variations = ocr_variations(text)

        generated.update(variations)

    generated = list(generated)

    # Repeat generation with combinations
    while len(generated) < TARGET_PER_LABEL:

        base = random.choice(original_texts)

        variant = random.choice([
            base.lower(),
            base.upper(),
            base.title(),
            base.replace(" ", ""),
            base.replace(" ", " "),
            base + ":",
            base + ".",
            base.replace("O", "0"),
            base.replace("o", "0"),
            base.replace("I", "1"),
            base.replace("i", "1"),
        ])

        generated.append(variant)

    # Keep target number
    generated = generated[:TARGET_PER_LABEL]

    for text in generated:

        rows.append({
            "text": text,
            "label": label
        })


# --------------------------------------------------
# Save
# --------------------------------------------------

expanded_df = pd.DataFrame(rows)

expanded_df = expanded_df.drop_duplicates(
    subset=["text", "label"]
)

expanded_df.to_csv(
    OUTPUT_FILE,
    index=False,
    encoding="utf-8"
)


print("\n================================")
print("Dataset expansion completed")
print("================================")

print(
    f"New samples: {len(expanded_df)}"
)

print(
    f"Labels: {expanded_df['label'].nunique()}"
)

print(
    f"Saved to: {OUTPUT_FILE}"
)