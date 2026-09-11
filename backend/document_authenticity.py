import os
import io
import cv2
import joblib
import random
import requests
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from PIL import Image, ImageChops, ImageEnhance, ImageFilter

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import (
    GroupShuffleSplit,
    GroupKFold
)
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    classification_report,
    confusion_matrix
)


# ============================================================
# CONFIGURATION
# ============================================================

DATASET = "ud-biometrics/passport-dataset"

PARQUET_URL = (
    "https://huggingface.co/api/datasets/"
    "ud-biometrics/passport-dataset/"
    "parquet/default/train/0.parquet"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATA_DIR = os.path.join(BASE_DIR, "data")
GENUINE_DIR = os.path.join(DATA_DIR, "genuine")
TAMPERED_DIR = os.path.join(DATA_DIR, "tampered")

OUTPUT_DIR = os.path.join(BASE_DIR, "output")
VIS_DIR = os.path.join(OUTPUT_DIR, "visualizations")

MODEL_DIR = os.path.join(BASE_DIR, "models")

PARQUET_FILE = os.path.join(
    BASE_DIR,
    "passport_dataset.parquet"
)

MODEL_FILE = os.path.join(
    MODEL_DIR,
    "document_authenticity_model.pkl"
)


# Number of tampered variants per method per genuine image
# (4 methods × 3 variants = 12 tampered per genuine)

VARIANTS_PER_METHOD = 3

RANDOM_STATE = 42


# ============================================================
# CREATE DIRECTORIES
# ============================================================

def create_directories():

    directories = [
        DATA_DIR,
        GENUINE_DIR,
        TAMPERED_DIR,
        OUTPUT_DIR,
        VIS_DIR,
        MODEL_DIR
    ]

    for directory in directories:

        os.makedirs(
            directory,
            exist_ok=True
        )


# ============================================================
# DOWNLOAD PARQUET DATASET
# ============================================================

def download_dataset():

    print("\n========================================")
    print("DOWNLOADING HUGGING FACE DATASET")
    print("========================================")

    if os.path.exists(PARQUET_FILE):

        print(
            "Parquet file already exists."
        )

        return

    response = requests.get(
        PARQUET_URL,
        timeout=120
    )

    response.raise_for_status()

    with open(
        PARQUET_FILE,
        "wb"
    ) as file:

        file.write(
            response.content
        )

    print(
        "Downloaded:",
        PARQUET_FILE
    )


# ============================================================
# READ PARQUET
# ============================================================

def read_dataset():

    print("\nReading Parquet file...")

    df = pd.read_parquet(
        PARQUET_FILE
    )

    print(
        "Rows:",
        len(df)
    )

    print(
        "Columns:",
        df.columns.tolist()
    )

    return df


# ============================================================
# EXTRACT IMAGE BYTES
# ============================================================

def extract_image_bytes(image_value):

    """
    Handles Hugging Face image columns.

    Depending on the Parquet conversion,
    image_value may be:

        dict
        bytes
        numpy object
    """

    # ------------------------------------------
    # Dictionary
    # ------------------------------------------

    if isinstance(
        image_value,
        dict
    ):

        image_bytes = image_value.get(
            "bytes"
        )

        if image_bytes is not None:

            return image_bytes

        image_path = image_value.get(
            "path"
        )

        if image_path and os.path.exists(
            image_path
        ):

            with open(
                image_path,
                "rb"
            ) as file:

                return file.read()

    # ------------------------------------------
    # Bytes
    # ------------------------------------------

    if isinstance(
        image_value,
        bytes
    ):

        return image_value

    # ------------------------------------------
    # Bytearray
    # ------------------------------------------

    if isinstance(
        image_value,
        bytearray
    ):

        return bytes(
            image_value
        )

    return None


# ============================================================
# SAVE GENUINE IMAGES
# ============================================================

def extract_genuine_images(df):

    print("\n========================================")
    print("EXTRACTING GENUINE IMAGES")
    print("========================================")

    if "image" not in df.columns:

        raise ValueError(
            "No 'image' column found."
        )

    saved = []

    for index, row in df.iterrows():

        image_bytes = extract_image_bytes(
            row["image"]
        )

        if image_bytes is None:

            print(
                f"Could not extract image {index}"
            )

            continue

        try:

            image = Image.open(
                io.BytesIO(image_bytes)
            )

            image = image.convert(
                "RGB"
            )

            filename = (
                f"genuine_{index:04d}.jpg"
            )

            filepath = os.path.join(
                GENUINE_DIR,
                filename
            )

            image.save(
                filepath,
                "JPEG",
                quality=95
            )

            saved.append(
                filepath
            )

            print(
                f"Saved: {filename}"
            )

        except Exception as error:

            print(
                f"Error processing image {index}:",
                error
            )

    print(
        f"\nGenuine images saved: {len(saved)}"
    )

    return saved


# ============================================================
# RANDOM RECTANGLE
# ============================================================

def random_rectangle(
    width,
    height
):

    # Rectangle size
    rect_width = int(
        width * random.uniform(
            0.08,
            0.25
        )
    )

    rect_height = int(
        height * random.uniform(
            0.08,
            0.25
        )
    )

    x1 = random.randint(
        0,
        max(0, width - rect_width)
    )

    y1 = random.randint(
        0,
        max(0, height - rect_height)
    )

    x2 = min(
        width,
        x1 + rect_width
    )

    y2 = min(
        height,
        y1 + rect_height
    )

    return (
        x1,
        y1,
        x2,
        y2
    )


# ============================================================
# TAMPERING METHOD 1
# COPY / PASTE REGION
# ============================================================

def tamper_copy_paste(image):

    image = image.copy()

    width, height = image.size

    source_box = random_rectangle(
        width,
        height
    )

    target_box = random_rectangle(
        width,
        height
    )

    source = image.crop(
        source_box
    )

    target_width = (
        target_box[2] -
        target_box[0]
    )

    target_height = (
        target_box[3] -
        target_box[1]
    )

    source = source.resize(
        (
            target_width,
            target_height
        )
    )

    image.paste(
        source,
        (
            target_box[0],
            target_box[1]
        )
    )

    return image


# ============================================================
# TAMPERING METHOD 2
# BLUR REGION
# ============================================================

def tamper_blur(image):

    image = image.copy()

    width, height = image.size

    box = random_rectangle(
        width,
        height
    )

    region = image.crop(
        box
    )

    radius = random.uniform(2, 6)

    region = region.filter(
        ImageFilter.GaussianBlur(
            radius=radius
        )
    )

    image.paste(
        region,
        (
            box[0],
            box[1]
        )
    )

    return image


# ============================================================
# TAMPERING METHOD 3
# COLOR MANIPULATION
# ============================================================

def tamper_color(image):

    image = image.copy()

    width, height = image.size

    box = random_rectangle(
        width,
        height
    )

    region = image.crop(
        box
    )

    # Change brightness
    region = ImageEnhance.Brightness(
        region
    ).enhance(
        random.uniform(
            0.55,
            1.5
        )
    )

    # Change contrast
    region = ImageEnhance.Contrast(
        region
    ).enhance(
        random.uniform(
            0.6,
            1.5
        )
    )

    # Change color saturation
    region = ImageEnhance.Color(
        region
    ).enhance(
        random.uniform(
            0.5,
            1.6
        )
    )

    image.paste(
        region,
        (
            box[0],
            box[1]
        )
    )

    return image


# ============================================================
# TAMPERING METHOD 4
# JPEG RECOMPRESSION
# ============================================================

def tamper_recompression(image):

    buffer = io.BytesIO()

    quality = random.randint(
        15,
        60
    )

    image.save(
        buffer,
        format="JPEG",
        quality=quality
    )

    buffer.seek(0)

    compressed = Image.open(
        buffer
    ).convert(
        "RGB"
    )

    return compressed


# ============================================================
# CREATE TAMPERED DATASET
# ============================================================

def create_tampered_dataset(
    genuine_images
):

    print("\n========================================")
    print("CREATING TAMPERED IMAGES")
    print("========================================")

    methods = [
        tamper_copy_paste,
        tamper_blur,
        tamper_color,
        tamper_recompression
    ]

    created = []

    for image_number, filepath in enumerate(
        genuine_images
    ):

        image = Image.open(
            filepath
        ).convert(
            "RGB"
        )

        tamper_count = 0

        for method in methods:

            for variant in range(
                VARIANTS_PER_METHOD
            ):

                try:

                    tampered = method(
                        image
                    )

                    filename = (
                        f"tampered_"
                        f"{image_number:04d}_"
                        f"{tamper_count}.jpg"
                    )

                    output_path = os.path.join(
                        TAMPERED_DIR,
                        filename
                    )

                    tampered.save(
                        output_path,
                        "JPEG",
                        quality=90
                    )

                    created.append(
                        output_path
                    )

                    tamper_count += 1

                except Exception as error:

                    print(
                        "Tampering error:",
                        error
                    )

    print(
        f"Tampered images created: {len(created)}"
    )

    return created


# ============================================================
# ELA
# ============================================================

def calculate_ela(
    image_path,
    quality=90
):

    original = Image.open(
        image_path
    ).convert(
        "RGB"
    )

    buffer = io.BytesIO()

    original.save(
        buffer,
        format="JPEG",
        quality=quality
    )

    buffer.seek(0)

    compressed = Image.open(
        buffer
    ).convert(
        "RGB"
    )

    difference = ImageChops.difference(
        original,
        compressed
    )

    extrema = difference.getextrema()

    max_difference = max(
        channel[1]
        for channel in extrema
    )

    if max_difference == 0:

        max_difference = 1

    scale = 255.0 / max_difference

    ela_image = ImageEnhance.Brightness(
        difference
    ).enhance(
        scale
    )

    ela_array = np.array(
        ela_image
    ).astype(
        np.float32
    )

    gray_ela = cv2.cvtColor(
        ela_array.astype(
            np.uint8
        ),
        cv2.COLOR_RGB2GRAY
    )

    return (
        ela_array,
        gray_ela
    )


# ============================================================
# FEATURE EXTRACTION
# ============================================================

def extract_features(
    image_path
):

    image = cv2.imread(
        image_path
    )

    if image is None:

        raise ValueError(
            f"Could not read {image_path}"
        )

    # ------------------------------------------
    # Resize
    # ------------------------------------------

    image = cv2.resize(
        image,
        (
            800,
            600
        )
    )

    # ------------------------------------------
    # Gray
    # ------------------------------------------

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    # ------------------------------------------
    # ELA
    # ------------------------------------------

    ela, ela_gray = calculate_ela(
        image_path
    )

    ela_mean = float(
        np.mean(ela)
    )

    ela_std = float(
        np.std(ela)
    )

    ela_max = float(
        np.max(ela)
    )

    # Percentage of high ELA pixels
    ela_high_pixels = float(
        np.mean(
            ela_gray > 40
        )
    )

    # ------------------------------------------
    # Texture
    # ------------------------------------------

    laplacian = cv2.Laplacian(
        gray,
        cv2.CV_64F
    )

    texture_score = float(
        laplacian.var()
    )

    # ------------------------------------------
    # Edges
    # ------------------------------------------

    edges = cv2.Canny(
        gray,
        100,
        200
    )

    edge_density = float(
        np.mean(
            edges > 0
        )
    )

    # ------------------------------------------
    # Color
    # ------------------------------------------

    hsv = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2HSV
    )

    hue_std = float(
        np.std(
            hsv[:, :, 0]
        )
    )

    saturation_std = float(
        np.std(
            hsv[:, :, 1]
        )
    )

    brightness_std = float(
        np.std(
            hsv[:, :, 2]
        )
    )

    # ------------------------------------------
    # Blur
    # ------------------------------------------

    blur_score = float(
        cv2.Laplacian(
            gray,
            cv2.CV_64F
        ).var()
    )

    # ------------------------------------------
    # Noise estimation
    # ------------------------------------------

    noise = cv2.Laplacian(
        gray,
        cv2.CV_64F
    )

    noise_score = float(
        np.std(noise)
    )

    # ------------------------------------------
    # Image dimensions
    # ------------------------------------------

    height, width = gray.shape

    aspect_ratio = float(
        width / height
    )

    # ------------------------------------------
    # Final feature vector
    # ------------------------------------------

    features = [

        ela_mean,
        ela_std,
        ela_max,
        ela_high_pixels,

        texture_score,
        edge_density,

        hue_std,
        saturation_std,
        brightness_std,

        blur_score,
        noise_score,

        width,
        height,
        aspect_ratio
    ]

    return np.array(
        features,
        dtype=np.float32
    )


# ============================================================
# BUILD ML DATASET
# ============================================================

def build_feature_dataset():

    print("\n========================================")
    print("EXTRACTING FEATURES")
    print("========================================")

    rows = []

    # ------------------------------------------
    # Genuine
    # ------------------------------------------

    genuine_files = [
        os.path.join(
            GENUINE_DIR,
            file
        )

        for file in os.listdir(
            GENUINE_DIR
        )

        if file.lower().endswith(
            (
                ".jpg",
                ".jpeg",
                ".png"
            )
        )
    ]

    for filepath in genuine_files:

        try:

            features = extract_features(
                filepath
            )

            source_id = os.path.basename(
                filepath
            ).split("_")[1].split(".")[0]

            rows.append(
                {
                    "filepath": filepath,
                    "label": 0,
                    "source_id": source_id,
                    **{
                        f"feature_{i}": value
                        for i, value in enumerate(
                            features
                        )
                    }
                }
            )

        except Exception as error:

            print(
                "Feature error:",
                filepath,
                error
            )

    # ------------------------------------------
    # Tampered
    # ------------------------------------------

    tampered_files = [
        os.path.join(
            TAMPERED_DIR,
            file
        )

        for file in os.listdir(
            TAMPERED_DIR
        )

        if file.lower().endswith(
            (
                ".jpg",
                ".jpeg",
                ".png"
            )
        )
    ]

    for filepath in tampered_files:

        try:

            features = extract_features(
                filepath
            )

            filename = os.path.basename(
                filepath
            )

            # tampered_0000_0.jpg
            parts = filename.split("_")

            source_id = parts[1]

            rows.append(
                {
                    "filepath": filepath,
                    "label": 1,
                    "source_id": source_id,
                    **{
                        f"feature_{i}": value
                        for i, value in enumerate(
                            features
                        )
                    }
                }
            )

        except Exception as error:

            print(
                "Feature error:",
                filepath,
                error
            )

    dataset = pd.DataFrame(
        rows
    )

    csv_path = os.path.join(
        OUTPUT_DIR,
        "features.csv"
    )

    dataset.to_csv(
        csv_path,
        index=False
    )

    print(
        "\nFeature dataset saved:"
    )

    print(csv_path)

    print(
        "\nClass distribution:"
    )

    print(
        dataset["label"].value_counts()
    )

    return dataset


# ============================================================
# HUMAN-READABLE FEATURE NAMES
# ============================================================

FEATURE_NAMES = [
    "ELA Mean",
    "ELA Std Dev",
    "ELA Max",
    "ELA High Pixels %",
    "Texture Score",
    "Edge Density",
    "Hue Std Dev",
    "Saturation Std Dev",
    "Brightness Std Dev",
    "Blur Score",
    "Noise Score",
    "Width",
    "Height",
    "Aspect Ratio"
]


# ============================================================
# HYPERPARAMETER TUNING
# ============================================================

def tune_hyperparameters(dataset):

    print("\n========================================")
    print("HYPERPARAMETER TUNING")
    print("========================================")

    feature_columns = [
        column
        for column in dataset.columns
        if column.startswith(
            "feature_"
        )
    ]

    X = dataset[feature_columns]
    y = dataset["label"]
    groups = dataset["source_id"]

    n_groups = groups.nunique()
    n_splits = min(5, n_groups)

    param_grid = [
        {"n_estimators": 200, "max_depth": 8},
        {"n_estimators": 200, "max_depth": 12},
        {"n_estimators": 200, "max_depth": 16},
        {"n_estimators": 300, "max_depth": 8},
        {"n_estimators": 300, "max_depth": 12},
        {"n_estimators": 300, "max_depth": 16},
        {"n_estimators": 400, "max_depth": 8},
        {"n_estimators": 400, "max_depth": 12},
        {"n_estimators": 400, "max_depth": 16},
    ]

    gkf = GroupKFold(
        n_splits=n_splits
    )

    best_score = -1
    best_params = None
    results = []

    for params in param_grid:

        fold_scores = []

        for train_idx, test_idx in gkf.split(
            X, y, groups
        ):

            X_train = X.iloc[train_idx]
            X_test = X.iloc[test_idx]
            y_train = y.iloc[train_idx]
            y_test = y.iloc[test_idx]

            model = RandomForestClassifier(
                n_estimators=params[
                    "n_estimators"
                ],
                max_depth=params[
                    "max_depth"
                ],
                min_samples_split=2,
                min_samples_leaf=1,
                random_state=RANDOM_STATE,
                class_weight="balanced",
                n_jobs=-1
            )

            model.fit(
                X_train,
                y_train
            )

            predictions = model.predict(
                X_test
            )

            fold_scores.append(
                accuracy_score(
                    y_test,
                    predictions
                )
            )

        mean_score = np.mean(fold_scores)
        std_score = np.std(fold_scores)

        results.append(
            {
                **params,
                "mean_accuracy": mean_score,
                "std": std_score
            }
        )

        if mean_score > best_score:

            best_score = mean_score
            best_params = params.copy()

        print(
            f"n_estimators="
            f"{params['n_estimators']}, "
            f"max_depth="
            f"{params['max_depth']}: "
            f"{mean_score:.4f} "
            f"\u00b1 {std_score:.4f}"
        )

    print(
        f"\nBest: "
        f"n_estimators="
        f"{best_params['n_estimators']}, "
        f"max_depth="
        f"{best_params['max_depth']}"
    )

    print(
        f"Mean accuracy: "
        f"{best_score:.4f}"
    )

    return best_params


# ============================================================
# CROSS-VALIDATION
# ============================================================

def cross_validate_model(
    dataset,
    best_params
):

    print("\n========================================")
    print("5-FOLD GROUP CROSS-VALIDATION")
    print("========================================")

    feature_columns = [
        column
        for column in dataset.columns
        if column.startswith(
            "feature_"
        )
    ]

    X = dataset[feature_columns]
    y = dataset["label"]
    groups = dataset["source_id"]

    n_groups = groups.nunique()
    n_splits = min(5, n_groups)

    print(
        f"Number of groups: {n_groups}"
    )

    print(
        f"Number of folds: {n_splits}"
    )

    gkf = GroupKFold(
        n_splits=n_splits
    )

    fold_metrics = {
        "accuracy": [],
        "precision": [],
        "recall": [],
        "f1": []
    }

    for fold, (train_idx, test_idx) in enumerate(
        gkf.split(X, y, groups)
    ):

        X_train = X.iloc[train_idx]
        X_test = X.iloc[test_idx]
        y_train = y.iloc[train_idx]
        y_test = y.iloc[test_idx]

        model = RandomForestClassifier(
            n_estimators=best_params[
                "n_estimators"
            ],
            max_depth=best_params[
                "max_depth"
            ],
            min_samples_split=2,
            min_samples_leaf=1,
            random_state=RANDOM_STATE,
            class_weight="balanced",
            n_jobs=-1
        )

        model.fit(
            X_train,
            y_train
        )

        predictions = model.predict(
            X_test
        )

        acc = accuracy_score(
            y_test,
            predictions
        )

        prec = precision_score(
            y_test,
            predictions,
            zero_division=0
        )

        rec = recall_score(
            y_test,
            predictions,
            zero_division=0
        )

        f1 = f1_score(
            y_test,
            predictions,
            zero_division=0
        )

        fold_metrics["accuracy"].append(acc)
        fold_metrics["precision"].append(prec)
        fold_metrics["recall"].append(rec)
        fold_metrics["f1"].append(f1)

        print(
            f"\nFold {fold + 1}: "
            f"Acc={acc:.4f}  "
            f"Prec={prec:.4f}  "
            f"Rec={rec:.4f}  "
            f"F1={f1:.4f}"
        )

    print(
        "\n----------------------------------------"
    )

    print(
        "CROSS-VALIDATION SUMMARY"
    )

    print(
        "----------------------------------------"
    )

    for metric_name, values in fold_metrics.items():

        mean_val = np.mean(values)
        std_val = np.std(values)

        print(
            f"{metric_name.capitalize():>10}: "
            f"{mean_val:.4f} \u00b1 {std_val:.4f}"
        )

    return fold_metrics


# ============================================================
# PLOT FEATURE IMPORTANCE
# ============================================================

def plot_feature_importance(
    model,
    feature_columns
):

    print(
        "\n----------------------------------------"
    )

    print(
        "FEATURE IMPORTANCE ANALYSIS"
    )

    print(
        "----------------------------------------"
    )

    importance = model.feature_importances_

    names = [
        FEATURE_NAMES[i]
        if i < len(FEATURE_NAMES)
        else col
        for i, col in enumerate(
            feature_columns
        )
    ]

    importance_df = pd.DataFrame(
        {
            "feature": names,
            "importance": importance
        }
    ).sort_values(
        "importance",
        ascending=True
    )

    top5 = importance_df.tail(5).iloc[::-1]

    print(
        "\nTop 5 most important features:"
    )

    for rank, (_, row) in enumerate(
        top5.iterrows(), 1
    ):

        print(
            f"  {rank}. "
            f"{row['feature']}: "
            f"{row['importance']:.4f}"
        )

    plt.figure(
        figsize=(10, 6)
    )

    colors = plt.cm.viridis(
        np.linspace(
            0.3,
            0.9,
            len(importance_df)
        )
    )

    plt.barh(
        importance_df["feature"],
        importance_df["importance"],
        color=colors
    )

    plt.xlabel(
        "Importance"
    )

    plt.title(
        "Random Forest Feature Importance"
    )

    plt.tight_layout()

    filepath = os.path.join(
        VIS_DIR,
        "feature_importance.png"
    )

    plt.savefig(
        filepath,
        dpi=150,
        bbox_inches="tight"
    )

    plt.close()

    print(
        f"\nPlot saved: {filepath}"
    )

    return importance_df


# ============================================================
# PLOT CONFUSION MATRIX
# ============================================================

def plot_confusion_matrix(
    y_true,
    y_pred
):

    print(
        "\n----------------------------------------"
    )

    print(
        "CONFUSION MATRIX VISUALIZATION"
    )

    print(
        "----------------------------------------"
    )

    cm = confusion_matrix(
        y_true,
        y_pred
    )

    fig, ax = plt.subplots(
        figsize=(8, 6)
    )

    im = ax.imshow(
        cm,
        interpolation="nearest",
        cmap=plt.cm.Blues
    )

    ax.figure.colorbar(
        im,
        ax=ax
    )

    classes = [
        "Genuine",
        "Tampered"
    ]

    ax.set(
        xticks=[0, 1],
        yticks=[0, 1],
        xticklabels=classes,
        yticklabels=classes,
        ylabel="True Label",
        xlabel="Predicted Label",
        title=(
            "Document Authenticity\n"
            "Confusion Matrix"
        )
    )

    total = cm.sum()

    for i in range(2):

        for j in range(2):

            count = cm[i, j]

            pct = (
                count / total * 100
            )

            ax.text(
                j,
                i,
                f"{count}\n({pct:.1f}%)",
                ha="center",
                va="center",
                color=(
                    "white"
                    if count > cm.max() / 2
                    else "black"
                ),
                fontsize=14
            )

    plt.tight_layout()

    filepath = os.path.join(
        VIS_DIR,
        "confusion_matrix.png"
    )

    plt.savefig(
        filepath,
        dpi=150,
        bbox_inches="tight"
    )

    plt.close()

    print(
        f"Confusion matrix saved: {filepath}"
    )


# ============================================================
# TRAIN RANDOM FOREST
# ============================================================

def train_model(dataset, best_params):

    print("\n========================================")
    print("TRAINING RANDOM FOREST")
    print("========================================")

    feature_columns = [
        column
        for column in dataset.columns
        if column.startswith(
            "feature_"
        )
    ]

    X = dataset[
        feature_columns
    ]

    y = dataset[
        "label"
    ]

    groups = dataset[
        "source_id"
    ]

    # ------------------------------------------
    # Group split
    #
    # Important:
    # Genuine image and its tampered copies
    # stay in the same train/test group.
    # ------------------------------------------

    splitter = GroupShuffleSplit(
        n_splits=1,
        test_size=0.25,
        random_state=RANDOM_STATE
    )

    train_indices, test_indices = next(
        splitter.split(
            X,
            y,
            groups
        )
    )

    X_train = X.iloc[
        train_indices
    ]

    X_test = X.iloc[
        test_indices
    ]

    y_train = y.iloc[
        train_indices
    ]

    y_test = y.iloc[
        test_indices
    ]

    print(
        "Training samples:",
        len(X_train)
    )

    print(
        "Testing samples:",
        len(X_test)
    )

    # ------------------------------------------
    # Random Forest
    # ------------------------------------------

    model = RandomForestClassifier(
        n_estimators=best_params[
            "n_estimators"
        ],
        max_depth=best_params[
            "max_depth"
        ],
        min_samples_split=2,
        min_samples_leaf=1,
        random_state=RANDOM_STATE,
        class_weight="balanced",
        n_jobs=-1
    )

    model.fit(
        X_train,
        y_train
    )

    # ------------------------------------------
    # Prediction
    # ------------------------------------------

    predictions = model.predict(
        X_test
    )

    accuracy = accuracy_score(
        y_test,
        predictions
    )

    print(
        f"\nAccuracy: {accuracy:.4f}"
    )

    print(
        "\nClassification Report:"
    )

    print(
        classification_report(
            y_test,
            predictions,
            target_names=[
                "Genuine",
                "Tampered"
            ],
            zero_division=0
        )
    )

    print(
        "\nConfusion Matrix:"
    )

    print(
        confusion_matrix(
            y_test,
            predictions
        )
    )

    # ------------------------------------------
    # Confusion matrix visualization
    # ------------------------------------------

    plot_confusion_matrix(
        y_test,
        predictions
    )

    # ------------------------------------------
    # Save model
    # ------------------------------------------

    model_data = {

        "model": model,

        "features": feature_columns,

        "description": (
            "Document authenticity classifier"
        )
    }

    joblib.dump(
        model_data,
        MODEL_FILE
    )

    print(
        "\nModel saved:"
    )

    print(
        MODEL_FILE
    )

    # ------------------------------------------
    # Feature importance
    # ------------------------------------------

    plot_feature_importance(
        model,
        feature_columns
    )

    return model


# ============================================================
# CREATE ELA VISUALIZATION
# ============================================================

def create_visualization(
    image_path
):

    print(
        "\nCreating visualization..."
    )

    image = Image.open(
        image_path
    ).convert(
        "RGB"
    )

    ela, ela_gray = calculate_ela(
        image_path
    )

    cv_image = cv2.imread(
        image_path
    )

    cv_image = cv2.resize(
        cv_image,
        (
            800,
            600
        )
    )

    gray = cv2.cvtColor(
        cv_image,
        cv2.COLOR_BGR2GRAY
    )

    edges = cv2.Canny(
        gray,
        100,
        200
    )

    plt.figure(
        figsize=(15, 5)
    )

    # Original
    plt.subplot(
        1,
        3,
        1
    )

    plt.imshow(
        image
    )

    plt.title(
        "Original Document"
    )

    plt.axis(
        "off"
    )

    # ELA
    plt.subplot(
        1,
        3,
        2
    )

    plt.imshow(
        ela.astype(
            np.uint8
        )
    )

    plt.title(
        "ELA Analysis"
    )

    plt.axis(
        "off"
    )

    # Edges
    plt.subplot(
        1,
        3,
        3
    )

    plt.imshow(
        edges,
        cmap="gray"
    )

    plt.title(
        "Edge Analysis"
    )

    plt.axis(
        "off"
    )

    plt.tight_layout()

    filename = os.path.join(
        VIS_DIR,
        "document_analysis.png"
    )

    plt.savefig(
        filename,
        dpi=150,
        bbox_inches="tight"
    )

    plt.close()

    print(
        "Visualization saved:"
    )

    print(
        filename
    )


# ============================================================
# PREDICT NEW DOCUMENT
# ============================================================

def predict_document(
    image_path
):

    print("\n========================================")
    print("DOCUMENT AUTHENTICITY PREDICTION")
    print("========================================")

    if not os.path.exists(
        MODEL_FILE
    ):

        raise FileNotFoundError(
            "Model not found. "
            "Train the model first."
        )

    # Load model
    model_data = joblib.load(
        MODEL_FILE
    )

    model = model_data[
        "model"
    ]

    feature_columns = model_data[
        "features"
    ]

    # Extract features
    features = extract_features(
        image_path
    )

    X = pd.DataFrame(
        [
            features
        ],
        columns=feature_columns
    )

    # Probability
    probabilities = model.predict_proba(
        X
    )[0]

    genuine_probability = (
        probabilities[0] * 100
    )

    tampered_probability = (
        probabilities[1] * 100
    )

    # ------------------------------------------
    # Risk score
    # ------------------------------------------

    risk_score = tampered_probability

    # ------------------------------------------
    # Decision
    # ------------------------------------------

    if risk_score < 30:

        decision = "LIKELY GENUINE"

    elif risk_score < 70:

        decision = "REVIEW REQUIRED"

    else:

        decision = "SUSPICIOUS / POSSIBLE TAMPERING"

    print(
        "\nGenuine Probability:",
        f"{genuine_probability:.2f}%"
    )

    print(
        "Tampering Probability:",
        f"{tampered_probability:.2f}%"
    )

    print(
        "Risk Score:",
        f"{risk_score:.2f}%"
    )

    print(
        "Decision:",
        decision
    )

    # ------------------------------------------
    # ELA visualization
    # ------------------------------------------

    create_visualization(
        image_path
    )

    return {

        "genuine_probability":
            genuine_probability,

        "tampered_probability":
            tampered_probability,

        "risk_score":
            risk_score,

        "decision":
            decision
    }


# ============================================================
# MAIN PROGRAM
# ============================================================

def main():

    random.seed(
        RANDOM_STATE
    )

    np.random.seed(
        RANDOM_STATE
    )

    create_directories()

    # ------------------------------------------
    # STEP 1
    # Download dataset
    # ------------------------------------------

    download_dataset()

    # ------------------------------------------
    # STEP 2
    # Read dataset
    # ------------------------------------------

    df = read_dataset()

    # ------------------------------------------
    # STEP 3
    # Extract genuine images
    # ------------------------------------------

    genuine_images = extract_genuine_images(
        df
    )

    if len(genuine_images) == 0:

        raise RuntimeError(
            "No images were extracted."
        )

    # ------------------------------------------
    # STEP 4
    # Create tampered images
    # ------------------------------------------

    create_tampered_dataset(
        genuine_images
    )

    # ------------------------------------------
    # STEP 5
    # Feature extraction
    # ------------------------------------------

    feature_dataset = build_feature_dataset()

    # ------------------------------------------
    # STEP 6
    # Hyperparameter tuning
    # ------------------------------------------

    best_params = tune_hyperparameters(
        feature_dataset
    )

    # ------------------------------------------
    # STEP 7
    # Cross-validation
    # ------------------------------------------

    cross_validate_model(
        feature_dataset,
        best_params
    )

    # ------------------------------------------
    # STEP 8
    # Train final model
    # ------------------------------------------

    train_model(
        feature_dataset,
        best_params
    )

    print("\n========================================")
    print("TRAINING COMPLETE")
    print("========================================")

    print(
        "\nModel:",
        MODEL_FILE
    )

    print(
        "\nTo test another document:"
    )

    print(
        "Use predict_document('your_image.jpg')"
    )


# ============================================================
# RUN
# ============================================================

if __name__ == "__main__":

    main()


# ============================================================
# INFERENCE SINGLETON
# Loaded ONCE at app startup via _load_model().
# MODEL_FILE path is already correct: backend/models/document_authenticity_model.pkl
# (BASE_DIR = dirname of this file = backend/)
# ============================================================

import logging as _da_logging
_da_logger = _da_logging.getLogger(__name__)

# Singleton state — populated by _load_model()
_model = None              # RandomForestClassifier or None
_model_feature_names = None  # list[str] e.g. ['feature_0',...,'feature_13']
_model_load_error = None   # str describing failure reason, or None


def _load_model() -> None:
    """
    Load the Random Forest .pkl once at startup.
    Called from main.py's startup_event().
    On any failure: logs a warning and leaves _model=None so that
    predict_tampering() gracefully returns None (UNAVAILABLE).
    Never raises — must never crash the app.

    The .pkl is stored as a dict:
        {'model': RandomForestClassifier, 'features': [...], 'description': str}
    We unwrap and store the classifier and the feature name list.
    """
    global _model, _model_feature_names, _model_load_error
    try:
        loaded = joblib.load(MODEL_FILE)
        # Unwrap dict wrapper if present (teammate's save format)
        if isinstance(loaded, dict) and "model" in loaded:
            clf = loaded["model"]
            _model_feature_names = loaded.get("features")  # ['feature_0',...]
        else:
            clf = loaded  # bare classifier — future-proof
            _model_feature_names = None
        if not hasattr(clf, "predict_proba"):
            raise ValueError(
                f"Loaded object type {type(clf).__name__} has no predict_proba — "
                "not a valid sklearn classifier"
            )
        _model = clf
        _da_logger.info(
            "Document authenticity model loaded OK: %s (classes=%s, features=%s)",
            MODEL_FILE, clf.classes_.tolist(), _model_feature_names,
        )
    except Exception as exc:
        _model_load_error = str(exc)
        _da_logger.warning(
            "Could not load document authenticity model (%s): %s",
            MODEL_FILE, exc,
        )


def predict_tampering(image_path: str) -> "dict | None":
    """
    Run the trained Random Forest model on a single document image.

    Returns a dict on success:
        {
            "tampered":     bool,   True if model predicts tampered
            "probability":  float,  0.0-1.0  (probability of TAMPERED class)
            "label":        str,    "TAMPERED" or "GENUINE"
        }

    Returns None (UNAVAILABLE signal) when:
      - The model was never loaded (pkl missing / joblib error at startup)
      - extract_features() raises (unreadable image, OpenCV error, etc.)
      - predict_proba() raises for any other reason
    Returning None never crashes the app; tamper.py falls back to ELA-only.
    """
    if _model is None:
        return None  # model unavailable — caller marks ML signal as UNAVAILABLE

    try:
        features = extract_features(image_path)      # 14-dim float32 vector
        # Wrap in a named DataFrame to match the training format exactly
        # (avoids sklearn UserWarning about missing feature names)
        if _model_feature_names:
            features_df = pd.DataFrame(
                [features], columns=_model_feature_names
            )
            proba = _model.predict_proba(features_df)[0]
        else:
            proba = _model.predict_proba(features.reshape(1, -1))[0]
        # predict_proba returns [[p_genuine, p_tampered]]
        # model was trained: label 0 = genuine, label 1 = tampered
        tampered_prob = float(proba[1])
        tampered = tampered_prob >= 0.5
        return {
            "tampered":    tampered,
            "probability": tampered_prob,
            "label":       "TAMPERED" if tampered else "GENUINE",
        }
    except Exception as exc:
        _da_logger.error("predict_tampering inference error: %s", exc)
        return None  # inference error — caller marks ML signal as UNAVAILABLE
