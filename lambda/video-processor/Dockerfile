# Use AWS Lambda Python base image (explicit x86_64 version)
FROM public.ecr.aws/lambda/python:3.9-x86_64

# Install system dependencies required by OpenCV
RUN yum install -y mesa-libGL pkgconfig cmake3 gcc gcc-c++ make \
    && ln -s /usr/bin/cmake3 /usr/bin/cmake || true \
    && yum clean all

# Make pip prefer wheels and upgrade itself
RUN python -m pip install --upgrade pip

# Pin transitive deps to wheel-friendly versions for py3.9 + manylinux2014
# (these are known-good with mediapipe 0.10.14–0.10.18 on py3.9)
RUN pip install --no-cache-dir \
    'jaxlib==0.4.26' \
    'ml-dtypes==0.4.0' \
    'sentencepiece==0.1.99'

# Now install mediapipe (and your other deps)
RUN pip install --no-cache-dir \
    mediapipe==0.10.18 \
    opencv-python-headless \
    boto3

# Build and include pthread naming shim to avoid MediaPipe crash
RUN yum install -y git gcc make && \
    git clone https://github.com/mitchellharper12/lambda-pthread-nameshim.git && \
    cd lambda-pthread-nameshim && make pthread_shim.so && \
    cp pthread_shim.so /opt/pthread_shim.so && \
    cd .. && rm -rf lambda-pthread-nameshim && \
    yum remove -y git gcc make && yum clean all && rm -rf /var/cache/yum

# Set LD_PRELOAD to patch MediaPipe's threading
COPY src/ /var/task/src/
ENV PYTHONPATH=/var/task/src

# Copy your Lambda function
COPY src/ /app/src/

# Set the Lambda function handler
CMD ["lambda.app.lambda_handler"]