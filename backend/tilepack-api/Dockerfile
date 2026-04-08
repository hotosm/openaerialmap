FROM golang:1.25-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /out/tilepack-api ./cmd/api

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/tilepack-api /tilepack-api
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/tilepack-api"]
