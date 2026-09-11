import pytesseract
from PIL import Image
from pytesseract import Output


pytesseract.pytesseract.tesseract_cmd = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)


def extract_ocr_data(image_path):

    image = Image.open(image_path)

    data = pytesseract.image_to_data(
        image,
        output_type=Output.DICT
    )

    words = []

    for i in range(len(data["text"])):

        text = data["text"][i].strip()

        if not text:
            continue

        confidence = float(data["conf"][i])

        words.append({
            "text": text,
            "confidence": confidence,
            "x": data["left"][i],
            "y": data["top"][i],
            "width": data["width"][i],
            "height": data["height"][i],
            "block": data["block_num"][i],
            "line": data["line_num"][i],
        })

    return words


if __name__ == "__main__":

    image_path = input(
        "Enter image path: "
    ).strip().strip('"')

    words = extract_ocr_data(image_path)

    print("\n========== OCR WORD DATA ==========\n")

    for word in words:

        print(
            f"{word['text']:25} "
            f"x={word['x']:4} "
            f"y={word['y']:4} "
            f"conf={word['confidence']:6.2f} "
            f"block={word['block']} "
            f"line={word['line']}"
        )