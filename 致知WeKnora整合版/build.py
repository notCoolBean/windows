"""Build desktop binaries; Linux builds run on the target ABI baseline."""
from pathlib import Path
import argparse
import os
import platform
import shutil
import subprocess

ROOT=Path(__file__).resolve().parent
TOOLS=ROOT/'.build-tools'
REPO=ROOT/'WeKnora'
parser=argparse.ArgumentParser()
parser.add_argument('target',choices=['mac','windows','frontend','linux-amd64','linux-arm64','linux-loongarch64'])
args=parser.parse_args()
if args.target=='frontend':
    subprocess.run(['npm','run','build'],cwd=REPO/'frontend',check=True)
    raise SystemExit(0)
env=dict(os.environ,GOPATH=str(TOOLS/'gopath'),GOCACHE=str(TOOLS/'go-cache'),
         GOPROXY='https://goproxy.cn,direct',CGO_ENABLED='1',CGO_CFLAGS='-Wno-deprecated-declarations')
flags='-X github.com/Tencent/WeKnora/internal/handler.Edition=lite -X google.golang.org/protobuf/reflect/protoregistry.conflictPolicy=warn'
flags+=' -X github.com/Tencent/WeKnora/internal/handler.Version=0.9.0-zhizhi.2 -X github.com/Tencent/WeKnora/internal/handler.CommitID=7476764-zhizhi'
tags='desktop,sqlite_fts5,production'
if args.target=='mac':
    env.update(GOOS='darwin',GOARCH='arm64',MACOSX_DEPLOYMENT_TARGET='13.3',
               CGO_CFLAGS='-Wno-deprecated-declarations -mmacosx-version-min=13.3',
               CGO_LDFLAGS='-Wl,-no_warn_duplicate_libraries -mmacosx-version-min=13.3')
    flags+=' -extldflags "-framework UniformTypeIdentifiers -mmacosx-version-min=13.3"'
    output=TOOLS/'zhizhi-mac'
elif args.target=='windows':
    subprocess.run(['x86_64-w64-mingw32-windres','-i',str(ROOT/'branding/zhizhi.rc'),
                    '-I',str(ROOT/'branding'),'-o',str(REPO/'cmd/desktop/zhizhi_windows_amd64.syso')],check=True)
    include=TOOLS/'sqlite-include'
    include.mkdir(exist_ok=True)
    sqlite=TOOLS/'gopath/pkg/mod/github.com/mattn/go-sqlite3@v1.14.24'
    for source, destination in [('sqlite3-binding.h','sqlite3.h'),('sqlite3ext.h','sqlite3ext.h')]:
        if not (include/destination).exists():
            shutil.copy2(sqlite/source,include/destination)
    env.update(GOOS='windows',GOARCH='amd64',CC='x86_64-w64-mingw32-gcc',CXX='x86_64-w64-mingw32-g++',
               CGO_CFLAGS='-Wno-deprecated-declarations -I'+str(include))
    flags+=' -H windowsgui'
    output=TOOLS/'zhizhi-windows.exe'
else:
    arch=args.target.removeprefix('linux-')
    native={'x86_64':'amd64','aarch64':'arm64','loongarch64':'loongarch64'}.get(platform.machine())
    if platform.system()!='Linux' or native!=arch:
        raise SystemExit('Linux 桌面程序须在对应架构、目标系统 ABI 基线的 Linux 构建机内编译，不能复用 macOS/Windows 运行库。')
    env.update(GOOS='linux',GOARCH='loong64' if arch=='loongarch64' else arch)
    if arch=='amd64':
        env['GOAMD64']='v1'
    if not shutil.which('pkg-config'):
        raise SystemExit('Linux 构建机缺少 pkg-config。')
    webkit=next((name for name in ('webkit2gtk-4.0','webkit2gtk-4.1')
                 if subprocess.run(['pkg-config','--exists','gtk+-3.0',name]).returncode==0),None)
    if not webkit:
        raise SystemExit('缺少目标系统的 GTK3/WebKitGTK 开发库。')
    if webkit=='webkit2gtk-4.1':
        tags+=',webkit2_41'
    if arch=='loongarch64':
        duckdb=Path(os.environ.get('ZZ_DUCKDB_LIB_DIR',''))
        if not os.environ.get('ZZ_DUCKDB_LIB_DIR') or not (duckdb/'libduckdb.so').is_file():
            raise SystemExit('龙芯构建需要同 ABI 的 DuckDB 1.5.2 动态库；请用 ZZ_DUCKDB_LIB_DIR 指定目录。当前 Go 依赖不提供龙芯预编译库。')
        tags+=',duckdb_use_lib'
        env['CGO_LDFLAGS']='-L'+str(duckdb.resolve())
    output=TOOLS/('zhizhi-'+args.target)
go=os.environ.get('GO') or (shutil.which('go') if args.target.startswith('linux-') else str(TOOLS/'go/bin/go'))
if not go:
    raise SystemExit('缺少 Go 1.26；请安装到构建机或用 GO 指定编译器路径。交付电脑不需要 Go。')
subprocess.run([go,'build','-p','3','-tags',tags,
                '-ldflags',flags,'-o',str(output),'./cmd/desktop'],cwd=REPO,env=env,check=True)
print(output)
