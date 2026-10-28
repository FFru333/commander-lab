import asyncio,json,sys,subprocess,os
from playwright.async_api import async_playwright
os.chdir(os.path.dirname(os.path.abspath(__file__)))
srv=subprocess.Popen([sys.executable,"-m","http.server","8099"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
out=[]
async def one(p,i,mode):
    args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream",f"--use-file-for-fake-video-capture=feeds/v{i}.y4m"]
    b=await p.chromium.launch(args=args);ctx=await b.new_context(viewport={"width":1200,"height":900},permissions=["camera"]);pg=await ctx.new_page()
    logs=[];pg.on("console",lambda m:logs.append(m.text));pg.on("pageerror",lambda e:logs.append("ERR "+str(e)))
    await pg.goto("http://127.0.0.1:8099/app.html");await pg.wait_for_timeout(800)
    await pg.click("#imTabs [data-it=scan]");await pg.wait_for_timeout(300)
    msg0=await pg.text_content("#scanMsg")
    if mode=="photo": await pg.set_input_files("#scanFile",f"feeds/p{i}.png")
    import time;t0=time.time()
    res=None
    for _ in range(120):
        await pg.wait_for_timeout(250)
        if await pg.query_selector("#scanRes .scset.ok, #scanRes .scfail"): break
    if await pg.query_selector("#scanRes .scard b"):
        await pg.wait_for_timeout(1500)
        res={"secs":round(time.time()-t0,1),"name":await pg.text_content("#scanRes .scard b"),"set":await pg.text_content("#scanRes .scset")}
        await pg.wait_for_timeout(2500);res["text"]=await pg.input_value("#imText")
    elif await pg.query_selector("#scanRes .scfail"): res={"fail":await pg.text_content("#scanRes .scfail p")}
    try: res=dict(res or {},debug=await pg.evaluate("JSON.stringify(window.__scanDebug||null)"))
    except Exception: pass
    await pg.screenshot(path=f"../../desk/data/scan-{mode}-{i}.png")
    out.append({"feed":i,"mode":mode,"start":msg0,"result":res,"logs":[l for l in logs if "404" not in l][:6]})
    await b.close()
async def main():
    async with async_playwright() as p:
        for i in range(4):
            for mode in ["camera","photo"]:
                try: await one(p,i,mode)
                except Exception as e: out.append({"feed":i,"mode":mode,"error":str(e)[:300]})
asyncio.run(main());srv.terminate()
print("\n".join(json.dumps(o,ensure_ascii=False) for o in out))
