package offline

import (
	"reflect"
	"testing"
)

func TestTruncationPreservesTokenizerSpecialTokens(t *testing.T) {
	for _, test := range []struct {
		full, plain, want []int
		budget            int
	}{
		{[]int{101, 1, 2, 3, 4, 102}, []int{1, 2, 3, 4}, []int{101, 1, 2, 102}, 4},
		{[]int{99, 1, 2, 3, 4}, []int{1, 2, 3, 4}, []int{99, 1, 2}, 3},
		{[]int{1, 2, 3, 4}, []int{1, 2, 3, 4}, []int{1, 2}, 2},
		{[]int{1, 2, 99}, []int{1, 2}, []int{1, 99}, 2},
	} {
		got, err := truncateWithSpecialTokens(test.full, test.plain, test.budget)
		if err != nil || !reflect.DeepEqual(got, test.want) {
			t.Fatalf("got %v %v, want %v", got, err, test.want)
		}
	}
	if _, err := truncateWithSpecialTokens([]int{101, 1, 102}, []int{1}, 2); err == nil {
		t.Fatal("accepted budget with no text space")
	}
}
