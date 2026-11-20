package retriever

import (
	"context"
	"github.com/Tencent/WeKnora/internal/types"
	"github.com/Tencent/WeKnora/internal/types/interfaces"
	"github.com/stretchr/testify/require"
	"testing"
)

type keywordOnlyRepository struct {
	interfaces.RetrieveEngineRepository
	saved   int
	vectors bool
}

func (r *keywordOnlyRepository) BatchSave(_ context.Context, rows []*types.IndexInfo, params map[string]any) error {
	r.saved += len(rows)
	vectors, _ := params["embedding"].(map[string][]float32)
	for _, vector := range vectors {
		r.vectors = r.vectors || len(vector) > 0
	}
	return nil
}
func (r *keywordOnlyRepository) EstimateStorageSize(_ context.Context, rows []*types.IndexInfo, _ map[string]any) int64 {
	return int64(len(rows))
}
func TestHybridEngineIndexesKeywordsWithoutAnEmbeddingModel(t *testing.T) {
	repo := &keywordOnlyRepository{}
	engine := NewKVHybridRetrieveEngine(repo, types.SQLiteRetrieverEngineType)
	rows := []*types.IndexInfo{{SourceID: "one", Content: "关键词资料"}}
	kinds := []types.RetrieverType{types.KeywordsRetrieverType, types.VectorRetrieverType}
	require.NoError(t, engine.BatchIndex(context.Background(), nil, rows, kinds))
	require.Error(t, engine.BatchIndex(context.Background(), nil, rows, []types.RetrieverType{types.VectorRetrieverType}))
	require.Equal(t, 1, repo.saved)
	require.False(t, repo.vectors)
	require.EqualValues(t, 1, engine.EstimateStorageSize(context.Background(), nil, rows, kinds))
}
