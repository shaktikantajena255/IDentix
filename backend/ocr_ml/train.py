import pandas as pd
import joblib

from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report


DATASET = "../dataset/expanded_keywords.csv"
MODEL_PATH = "../model/field_keyword_model.joblib"


print("Loading dataset...")

df = pd.read_csv(DATASET)

# Clean dataset
df["text"] = df["text"].astype(str).str.strip()
df["label"] = df["label"].astype(str).str.strip()

# Remove empty rows
df = df[
    (df["text"] != "") &
    (df["label"] != "")
].copy()

X = df["text"]
y = df["label"]


print(f"Total samples: {len(df)}")
print(f"Total labels: {y.nunique()}")


# Count samples per label
label_counts = y.value_counts()

print("\nLabels with fewer than 2 examples:")
print(label_counts[label_counts < 2])


# --------------------------------------------------
# Separate labels that can be evaluated
# --------------------------------------------------

common_mask = y.map(label_counts) >= 2

X_common = X[common_mask]
y_common = y[common_mask]

X_rare = X[~common_mask]
y_rare = y[~common_mask]


print("\nTrain/test eligible samples:", len(X_common))
print("Rare samples kept only for training:", len(X_rare))


# --------------------------------------------------
# Train/test split
# --------------------------------------------------

X_train, X_test, y_train, y_test = train_test_split(
    X_common,
    y_common,
    test_size=0.30,
    random_state=42,
    stratify=y_common
)


# Add rare classes to training set
X_train = pd.concat(
    [X_train, X_rare],
    ignore_index=True
)

y_train = pd.concat(
    [y_train, y_rare],
    ignore_index=True
)


print("\nTraining samples:", len(X_train))
print("Testing samples:", len(X_test))


# --------------------------------------------------
# ML Pipeline
# --------------------------------------------------

model = Pipeline([
    (
        "tfidf",
        TfidfVectorizer(
            lowercase=True,
            analyzer="char_wb",
            ngram_range=(2, 5),
            sublinear_tf=True
        )
    ),

    (
        "classifier",
        LogisticRegression(
            max_iter=5000
        )
    )
])


# --------------------------------------------------
# Train
# --------------------------------------------------

print("\nTraining model...")

model.fit(X_train, y_train)

print("Training completed.")


# --------------------------------------------------
# Evaluation
# --------------------------------------------------

print("\n========== MODEL EVALUATION ==========\n")

predictions = model.predict(X_test)

print(
    classification_report(
        y_test,
        predictions,
        zero_division=0
    )
)


# --------------------------------------------------
# Save model
# --------------------------------------------------

joblib.dump(model, MODEL_PATH)

print("\n======================================")
print("Model saved successfully:")
print(MODEL_PATH)
print("======================================")