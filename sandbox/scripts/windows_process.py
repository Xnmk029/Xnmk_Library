"""Observe an existing Windows child without stopping or relaunching it."""
import ctypes as c
from ctypes import wintypes as w
from datetime import datetime, timezone
import os

if os.name == 'nt':
    kernel=c.WinDLL('kernel32',use_last_error=True)
    kernel.OpenProcess.argtypes=[w.DWORD,w.BOOL,w.DWORD];kernel.OpenProcess.restype=w.HANDLE
    kernel.ReadProcessMemory.argtypes=[w.HANDLE,c.c_void_p,c.c_void_p,c.c_size_t,c.POINTER(c.c_size_t)]
    kernel.GetExitCodeProcess.argtypes=[w.HANDLE,c.POINTER(w.DWORD)]
    kernel.GetProcessTimes.argtypes=[w.HANDLE,*([c.POINTER(w.FILETIME)]*4)]
    kernel.CloseHandle.argtypes=[w.HANDLE]
    kernel.WaitForSingleObject.argtypes=[w.HANDLE,w.DWORD]

class ObservedProcess:
    def __init__(self,pid):
        self.pid=pid
        self.handle=kernel.OpenProcess(0x100000|0x0400|0x0010,False,pid)
        if not self.handle:raise c.WinError(c.get_last_error())
        times=[w.FILETIME() for _ in range(4)]
        if not kernel.GetProcessTimes(self.handle,*map(c.byref,times)):raise c.WinError(c.get_last_error())
        self.created_timestamp=(((times[0].dwHighDateTime<<32)|times[0].dwLowDateTime)/10_000_000)-11644473600
        self.started_at=datetime.fromtimestamp(self.created_timestamp,timezone.utc).isoformat()
        self.cwd=self.current_directory()

    def read(self,addr,size):
        buf=c.create_string_buffer(size);count=c.c_size_t()
        if not kernel.ReadProcessMemory(self.handle,addr,buf,size,c.byref(count)) or count.value!=size:raise c.WinError(c.get_last_error())
        return buf.raw

    def current_directory(self):
        assert c.sizeof(c.c_void_p)==8,'64-bit observer required'
        info=(c.c_void_p*6)();returned=w.ULONG()
        nt=c.WinDLL('ntdll').NtQueryInformationProcess
        nt.argtypes=[w.HANDLE,w.ULONG,c.c_void_p,w.ULONG,c.POINTER(w.ULONG)]
        if nt(self.handle,0,c.byref(info),c.sizeof(info),c.byref(returned))!=0:raise OSError('Cannot query process PEB')
        params=int.from_bytes(self.read(info[1]+0x20,8),'little')
        value=self.read(params+0x38,16);length=int.from_bytes(value[:2],'little');pointer=int.from_bytes(value[8:16],'little')
        return self.read(pointer,length).decode('utf-16-le')

    def poll(self):
        if kernel.WaitForSingleObject(self.handle,0)==0x102:return None
        code=w.DWORD()
        if not kernel.GetExitCodeProcess(self.handle,c.byref(code)):raise c.WinError(c.get_last_error())
        return code.value

    def elapsed_seconds(self):
        times=[w.FILETIME() for _ in range(4)]
        if not kernel.GetProcessTimes(self.handle,*map(c.byref,times)):raise c.WinError(c.get_last_error())
        ticks=lambda x:((x.dwHighDateTime<<32)|x.dwLowDateTime)/10_000_000
        return ticks(times[1])-ticks(times[0])

    def close(self):
        if self.handle:kernel.CloseHandle(self.handle);self.handle=None

if __name__=='__main__':
    import sys,json
    for pid in map(int,sys.argv[1:]):
        p=ObservedProcess(pid)
        print(json.dumps({'pid':pid,'cwd':p.cwd,'started_at':p.started_at,'exit_code':p.poll()}));p.close()
