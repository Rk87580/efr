FROM ubuntu:20.04

WORKDIR /app

# Required libraries
RUN apt-get update && \
    apt-get install -y \
        bash \
        curl \
        unzip \
        libstdc++6 \
        libssl1.1 \
        ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# copy project
COPY . .

# go to installer folder
WORKDIR /app/EFR_NO_2.7.3_install_linux64

# make scripts executable
RUN chmod +x install.sh run.sh

# ⭐ THIS STEP WAS MISSING
# install runtime (creates app/node)
RUN ./install.sh

# start app
CMD ["./run.sh"]
