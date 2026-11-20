//go:build !windows

package offline

import "os/exec"

func hideWindow(cmd *exec.Cmd) {}
