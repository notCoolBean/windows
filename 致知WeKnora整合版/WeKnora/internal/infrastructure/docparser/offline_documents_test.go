package docparser

import (
 "archive/zip"
 "bytes"
 "context"
 "os"
 "os/exec"
 "strings"
 "testing"

 "github.com/Tencent/WeKnora/internal/types"
)

func TestOfflineOfficeRoutingAndDOCX(t *testing.T) {
 script:=os.Getenv("ZZ_TEST_DOCUMENT_SCRIPT")
 if script=="" {t.Skip("set ZZ_TEST_DOCUMENT_SCRIPT to the packaged parser")}
 python,err:=exec.LookPath("python3");if err!=nil{t.Fatal(err)}
 t.Setenv("ZZ_DOCUMENT_PYTHON",python)
 t.Setenv("ZZ_DOCUMENT_SCRIPT",script)
 for _,kind:=range []string{"docx","xlsx","pptx","pdf"} {
  if types.DefaultParserEngine(kind)!=SimpleEngineName||!IsSimpleFormat(kind){t.Fatalf("%s not routed offline",kind)}
 }
 var data bytes.Buffer
 archive:=zip.NewWriter(&data)
 part,err:=archive.Create("word/document.xml");if err!=nil{t.Fatal(err)}
 _,err=part.Write([]byte(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>本地知识库测试</w:t></w:r></w:p></w:body></w:document>`))
 if err!=nil{t.Fatal(err)};if err=archive.Close();err!=nil{t.Fatal(err)}
 reader:=&SimpleFormatReader{}
 result,err:=reader.Read(context.Background(),&types.ReadRequest{FileType:"docx",FileName:"测试.docx",FileContent:data.Bytes()})
 if err!=nil{t.Fatal(err)}
 if !strings.Contains(result.MarkdownContent,"本地知识库测试"){t.Fatalf("unexpected text: %s",result.MarkdownContent)}
}
