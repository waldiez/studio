FROM ubuntu:24.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# install system dependencies
RUN apt update && \
    apt install -y curl unzip git ca-certificates python3-dev python3-pip && \
    curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh && \
    bash nodesource_setup.sh && \
    apt install -y nodejs curl && \
    apt clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /var/cache/apt/archives/*

# install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=/root/.bun/bin:${PATH}

WORKDIR /tmp/package

# install python dependencies
RUN pip3 install --break-system-packages --upgrade build twine
COPY requirements/main.txt /tmp/requirements.txt
RUN pip3 install --break-system-packages -r /tmp/requirements.txt && \
    rm -f /tmp/requirements.txt

# copy source code
COPY . /tmp/package

# build the frontend
ENV WALDIEZ_STUDIO_BASE_URL=/frontend/
# try to build the frontend even with low memory
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN bun install && bun run build
# build the backend
RUN python3 -m build --sdist --wheel --outdir dist/

# Final image
FROM python:3.12-slim

LABEL maintainer="waldiez <development@waldiez.io>"
LABEL org.opencontainers.image.source="quay.io/waldiez/studio"
LABEL org.opencontainers.image.title="waldiez/studio"
LABEL org.opencontainers.image.description="Waldiez Studio"

# set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEBIAN_FRONTEND="noninteractive"
ENV DEBCONF_NONINTERACTIVE_SEEN=true

# install system dependencies
RUN apt update && \
    apt upgrade -y && \
    apt install -y --no-install-recommends \
    tzdata \
    locales \
    bzip2 \
    ca-certificates \
    build-essential \
    wget \
    fonts-liberation \
    git \
    sudo \
    openssl \
    curl \
    tini \
    zip \
    unzip \
    graphviz && \
    sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    apt clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /var/cache/apt/archives/*

ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US.UTF-8 \
    LC_ALL=en_US.UTF-8 \
    LC_CTYPE=en_US.UTF-8 \
    TZ=Etc/UTC

# I prefer colors
RUN sed -i 's/^#force_color_prompt=yes/force_color_prompt=yes/' /etc/skel/.bashrc

# create a non-root user
ARG GROUP_ID=1000
ENV GROUP_ID=${GROUP_ID}
RUN addgroup --system --gid ${GROUP_ID} user
ARG USER_ID=1000
ENV USER_ID=${USER_ID}
RUN adduser --disabled-password --gecos '' --shell /bin/bash --uid ${USER_ID} --gid ${GROUP_ID} user
RUN echo "user ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-user
RUN mkdir -p /home/user/tmp /home/user/.local/bin && \
    chown -R user:user /home/user
ENV PATH=/home/user/.local/bin:${PATH}

USER user
RUN pip install --upgrade pip

COPY --from=builder --chown=user:user /tmp/package/dist/*.whl /home/user/tmp/
RUN pip install --user /home/user/tmp/*.whl && \
    rm -rf /home/user/tmp

ARG WALDIEZ_STUDIO_PORT=8000
ENV WALDIEZ_STUDIO_PORT=${WALDIEZ_STUDIO_PORT}

EXPOSE ${WALDIEZ_STUDIO_PORT}
# we are in docker, so 'localhost' might not work
ENV WALDIEZ_STUDIO_HOST=0.0.0.0
ENV WALDIEZ_STUDIO_TRUSTED_HOSTS=0.0.0.0,localhost
ENV TINI_SUBREAPER=true
ENTRYPOINT ["/usr/bin/tini", "--"]

WORKDIR /home/user

CMD ["waldiez-studio"]
