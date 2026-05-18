from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
from routers import auth, voc, reports

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="VOC SaaS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(voc.router)
app.include_router(reports.router)


@app.get("/health")
def health():
    return {"status": "ok"}
