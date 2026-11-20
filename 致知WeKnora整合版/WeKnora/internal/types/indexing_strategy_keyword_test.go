package types

import "testing"

func TestKeywordOnlyIndexDoesNotRequireEmbedding(t *testing.T) {
	kb := &KnowledgeBase{IndexingStrategy: IndexingStrategy{KeywordEnabled: true}}
	if kb.NeedsEmbeddingModel() || !kb.NeedsSearchIndex() || !kb.IndexingStrategy.NeedsChunks() {
		t.Fatal("keyword indexing must retain chunks and text index without an embedding model")
	}
	kb.IndexingStrategy.VectorEnabled = true
	if !kb.NeedsEmbeddingModel() {
		t.Fatal("semantic indexing still requires a model")
	}
}
