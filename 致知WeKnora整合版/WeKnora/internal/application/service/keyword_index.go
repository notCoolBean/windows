package service

import (
	"context"
	"github.com/Tencent/WeKnora/internal/models/embedding"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
)

// An empty model ID denotes a text-only index. No model or vectors are created.
// Vector-enabled callers must validate their required model before reaching here.
func indexingEmbedder(ctx context.Context, models interfaces.ModelService, id string) (embedding.Embedder, error) {
	if id == "" {
		return nil, nil
	}
	return models.GetEmbeddingModel(ctx, id)
}

func indexDimensions(model embedding.Embedder) int {
	if model == nil {
		return 0
	}
	return model.GetDimensions()
}
