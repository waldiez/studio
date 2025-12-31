FROM ubuntu:24.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# install system dependencies
RUN apt update && \
    apt install -y \
    curl \
    unzip \
    git \
    ca-certificates \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    python3-dev \
    python3-pip && \
    curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh && \
    bash nodesource_setup.sh && \
    apt install -y nodejs && \
    apt clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /var/cache/apt/archives/*

# install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=/root/.bun/bin:${PATH}

WORKDIR /tmp/package

# install python dependencies
ENV PIP_BREAK_SYSTEM_PACKAGES=1

RUN python3 -m pip install --user --upgrade build twine
COPY requirements/main.txt /tmp/requirements.txt
RUN python3 -m pip install --user -r /tmp/requirements.txt && \
    rm -f /tmp/requirements.txt

# copy source code
COPY . /tmp/package

# build the frontend
ENV WALDIEZ_STUDIO_BASE_URL=/
# if there is not enough memory on the host, we can
# try to build the frontend even with low memory:
# ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN bun install && bun run build
# build the backend
RUN python3 -m build --sdist --wheel --outdir dist/

# Final image
FROM python:3.13-slim

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
    build-essential \
    bzip2 \
    curl \
    ca-certificates \
    zip \
    unzip \
    git \
    jq \
    ffmpeg \
    graphviz \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libgdk-pixbuf-xlib-2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    tini \
    tzdata \
    locales \
    sudo \
    xdg-utils \
    xvfb && \
    sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    curl -fsSL https://deb.nodesource.com/setup_22.x -o nodesource_setup.sh && \
    bash nodesource_setup.sh && \
    rm nodesource_setup.sh && \
    apt install -y nodejs && \
    npm install -g corepack && \
    corepack enable && \
    yarn set version stable && \
    sed -i -e 's/# en_US.UTF-8 UTF-8/en_US.UTF-8 UTF-8/' /etc/locale.gen && \
    locale-gen en_US.UTF-8 && \
    apt clean && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /var/cache/apt/archives/*

# Add ChromeDriver and Chrome
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
    CHROME_ARCH="linux64"; \
    elif [ "$ARCH" = "aarch64" ]; then \
    CHROME_ARCH="linux64"; \
    else \
    echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    LATEST_VERSION=$(curl -s "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json" | \
    jq -r '.channels.Stable.version') && \
    echo "Installing Chrome and ChromeDriver version: $LATEST_VERSION for $CHROME_ARCH" && \
    curl -Lo /tmp/chrome.zip "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/${LATEST_VERSION}/${CHROME_ARCH}/chrome-linux64.zip" && \
    unzip /tmp/chrome.zip -d /opt && \
    ln -sf /opt/chrome-linux64/chrome /usr/bin/google-chrome && \
    curl -Lo /tmp/chromedriver.zip "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/${LATEST_VERSION}/${CHROME_ARCH}/chromedriver-linux64.zip" && \
    unzip /tmp/chromedriver.zip -d /usr/local/bin && \
    mv /usr/local/bin/chromedriver-linux64/chromedriver /usr/local/bin/chromedriver && \
    chmod +x /usr/local/bin/chromedriver && \
    rm -rf /tmp/chrome.zip /tmp/chromedriver.zip /usr/local/bin/chromedriver-linux64

# Add GeckoDriver (for Firefox)
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "x86_64" ]; then \
    GECKO_ARCH="linux64"; \
    elif [ "$ARCH" = "aarch64" ]; then \
    GECKO_ARCH="linux-aarch64"; \
    else \
    echo "Unsupported architecture: $ARCH" && exit 1; \
    fi && \
    curl -fsSL https://packages.mozilla.org/apt/repo-signing-key.gpg | \
    gpg --dearmor -o /etc/apt/trusted.gpg.d/mozilla.gpg && \
    echo "deb https://packages.mozilla.org/apt mozilla main" > /etc/apt/sources.list.d/mozilla.list && \
    apt-get update && \
    apt-get install -y firefox && \
    FIREFOX_VERSION=$(firefox --version | grep -oP '\d+\.\d+') && \
    echo "Firefox version: $FIREFOX_VERSION" && \
    GECKO_VERSION=""; \
    for i in 1 2 3; do \
    GECKO_VERSION=$(curl -sL -o /dev/null -w '%{url_effective}' https://github.com/mozilla/geckodriver/releases/latest | awk -F/ '{print $NF}'); \
    if [ "$GECKO_VERSION" != "null" ] && [ -n "$GECKO_VERSION" ]; then break; fi; \
    echo "Retrying fetch of GeckoDriver version... ($i)"; \
    sleep 2; \
    done && \
    if [ -z "$GECKO_VERSION" ] || [ "$GECKO_VERSION" = "null" ]; then \
    echo "Failed to fetch GeckoDriver version" >&2; exit 1; \
    fi && \
    echo "GeckoDriver version: $GECKO_VERSION for $GECKO_ARCH" && \
    curl -Lo /tmp/geckodriver.tar.gz "https://github.com/mozilla/geckodriver/releases/download/${GECKO_VERSION}/geckodriver-${GECKO_VERSION}-${GECKO_ARCH}.tar.gz" && \
    tar -xzf /tmp/geckodriver.tar.gz -C /usr/local/bin && \
    chmod +x /usr/local/bin/geckodriver && \
    rm /tmp/geckodriver.tar.gz && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Ensure /usr/local/bin is in the PATH
ENV PATH="/usr/local/bin:${PATH}"

# Set locale and timezone
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
RUN addgroup --system --gid ${GROUP_ID} waldiez
ARG USER_ID=1000
ENV USER_ID=${USER_ID}
RUN adduser --disabled-password --gecos '' --shell /bin/bash --uid ${USER_ID} --gid ${GROUP_ID} waldiez
RUN echo "waldiez ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/90-waldiez
RUN mkdir -p /home/waldiez/tmp /home/waldiez/.local/bin

ENV PATH=/home/waldiez/.local/bin:${PATH}
RUN echo "export PATH=\"/home/waldiez/.local/bin:\$PATH\"" >> /home/waldiez/.bashrc && \
    chown -R waldiez:waldiez /home/waldiez

USER waldiez

# set pip environment variables
ENV PIP_USER=1
ENV PIP_BREAK_SYSTEM_PACKAGES=1

# Set display for headless operations if needed
ENV DISPLAY=:99

RUN pip install --upgrade pip

COPY --from=builder --chown=waldiez:waldiez /tmp/package/dist/*.whl /home/waldiez/tmp/
RUN pip install --user /home/waldiez/tmp/*.whl && \
    rm -rf /home/waldiez/tmp

ARG WALDIEZ_STUDIO_PORT=8000
ENV WALDIEZ_STUDIO_PORT=${WALDIEZ_STUDIO_PORT}

EXPOSE ${WALDIEZ_STUDIO_PORT}
# we are in docker, so 'localhost' might not work
ENV WALDIEZ_STUDIO_HOST=0.0.0.0
ENV WALDIEZ_STUDIO_TRUSTED_HOSTS=0.0.0.0,127.0.0.1,localhost
ENV TINI_SUBREAPER=true
ENTRYPOINT ["/usr/bin/tini", "--"]

COPY --chown=waldiez:waldiez scripts/start.sh /home/waldiez/start.sh
RUN mkdir -p /home/waldiez/workspace
RUN chmod +x /home/waldiez/start.sh

WORKDIR /home/waldiez/workspace

CMD ["/home/waldiez/start.sh"]
