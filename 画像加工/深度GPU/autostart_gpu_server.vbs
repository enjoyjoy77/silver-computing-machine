' GPU depth server silent launcher (ASCII only)
' Copied into the Windows Startup folder by 3_jidou_kidou_ON.bat.
' Uses the ASCII junction C:\Users\<user>\depth_gpu_j -> tool folder,
' so this file works no matter where it is placed.
Option Explicit
On Error Resume Next

Dim sh, home, cmd
Set sh = CreateObject("WScript.Shell")
home = sh.ExpandEnvironmentStrings("%USERPROFILE%")
cmd = """" & home & "\.venvs\depth_gpu\Scripts\pythonw.exe"" """ & _
      home & "\depth_gpu_j\server.py"""
sh.Run cmd, 0, False

If Err.Number <> 0 Then
    MsgBox "GPU server no kidou ni shippai shimashita." & vbCrLf & _
           "1_depth_wo_tsukuru.bat de setup wo yarinaoshite kudasai." & vbCrLf & _
           "(Error " & Err.Number & ")", 16, "depth GPU"
End If
