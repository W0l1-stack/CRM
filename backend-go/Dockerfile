FROM golang:1.25-alpine AS builder

WORKDIR /app

# go.sum is gitignored, so it is not present when Railway builds from the repo.
# Copy go.mod alone and let `go mod download` regenerate go.sum into a cached
# layer (the builder has network access).
COPY go.mod ./
RUN go mod download

COPY . .
# -mod=mod lets the build add any missing go.sum entries instead of failing the
# way the default -mod=readonly would without a committed go.sum.
RUN CGO_ENABLED=0 GOOS=linux go build -mod=mod -o main ./cmd/main.go

FROM alpine:latest

RUN apk --no-cache add ca-certificates
WORKDIR /root/

COPY --from=builder /app/main .

EXPOSE 3001
CMD ["./main"]
