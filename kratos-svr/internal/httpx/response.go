// Package httpx provides shared HTTP transport helpers.
package httpx

import (
	"net/http"

	kratoshttp "github.com/go-kratos/kratos/v3/transport/http"
	"google.golang.org/protobuf/encoding/protojson"
	"google.golang.org/protobuf/proto"
)

var responseMarshalOptions = protojson.MarshalOptions{
	EmitUnpopulated: true,
	UseEnumNumbers:  true,
}

// ProtoJSONResponseEncoder encodes protobuf responses using their JSON field
// names so the runtime response matches the generated OpenAPI contract.
func ProtoJSONResponseEncoder(w http.ResponseWriter, r *http.Request, v any) error {
	if v == nil {
		return nil
	}

	message, ok := v.(proto.Message)
	if !ok {
		return kratoshttp.DefaultResponseEncoder(w, r, v)
	}

	data, err := responseMarshalOptions.Marshal(message)
	if err != nil {
		return err
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	_, err = w.Write(data)
	return err
}
