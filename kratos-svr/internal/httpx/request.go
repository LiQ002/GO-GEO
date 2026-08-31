package httpx

import (
	"bytes"
	"fmt"
	"io"
	"mime"
	"net/http"

	"github.com/go-kratos/kratos/v3/errors"
	kratoshttp "github.com/go-kratos/kratos/v3/transport/http"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

var requestUnmarshalOptions = protojson.UnmarshalOptions{
	DiscardUnknown: false,
}

// ProtoJSONRequestDecoder decodes JSON request bodies using protobuf JSON field
// names so the runtime request contract matches the generated OpenAPI client.
func ProtoJSONRequestDecoder(r *http.Request, v any) error {
	message, ok := v.(proto.Message)
	if !ok || !isJSONContentType(r.Header.Get("Content-Type")) {
		return kratoshttp.DefaultRequestDecoder(r, v)
	}

	data, err := io.ReadAll(r.Body)
	r.Body = io.NopCloser(bytes.NewReader(data))
	if err != nil {
		return errors.BadRequest("CODEC", err.Error())
	}
	if len(data) == 0 {
		return nil
	}
	if err := requestUnmarshalOptions.Unmarshal(data, message); err != nil {
		return errors.BadRequest("CODEC", fmt.Sprintf("body unmarshal %s", err.Error()))
	}
	return nil
}

func isJSONContentType(value string) bool {
	mediaType, _, err := mime.ParseMediaType(value)
	if err != nil {
		return false
	}
	return mediaType == "application/json" || mediaType == "application/protojson"
}
