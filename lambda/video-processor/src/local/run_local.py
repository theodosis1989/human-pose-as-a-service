from src.runner import process_video

if __name__ == "__main__":
    input_path = "src/local/input/pushup_user123_bad.mp4"
    output_path = "src/local/output/output-annotated_bad.mp4"
    landmark_path = "src/local/output/landmarks_bad.json"

    process_video(input_path, output_path, landmark_path)