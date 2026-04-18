from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import timedelta
import random

import models
import schemas
import auth
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="The Life Project API")

# Update CORS for local frontend testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/token", response_model=schemas.Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = auth.get_user(db, email=form_data.username)
    if not user or not auth.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=auth.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/users/", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = auth.get_user(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = auth.get_password_hash(user.password)
    db_user = models.User(
        email=user.email,
        hashed_password=hashed_password,
        struggle_profile=user.struggle_profile
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # Create initial growth tree
    initial_tree = models.GrowthTree(user_id=db_user.id)
    db.add(initial_tree)
    
    # Generate initial tasks based on struggles
    domains = ["awareness", "action", "meaning"]
    for domain in domains:
        db_task = models.Task(
            user_id=db_user.id,
            domain=domain,
            content=f"Initial {domain} task focusing on {random.choice(user.struggle_profile) if user.struggle_profile else 'general growth'}."
        )
        db.add(db_task)
        
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/users/me/", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.get("/tasks/", response_model=list[schemas.Task])
def read_tasks(current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    tasks = db.query(models.Task).filter(models.Task.user_id == current_user.id).all()
    return tasks

@app.post("/tasks/{task_id}/complete")
def complete_task(task_id: int, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    task = db.query(models.Task).filter(models.Task.id == task_id, models.Task.user_id == current_user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    from datetime import datetime, timezone
    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    return {"status": "success"}

@app.post("/reflections/", response_model=schemas.Reflection)
def create_reflection(reflection: schemas.ReflectionCreate, current_user: models.User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    db_reflection = models.Reflection(
        user_id=current_user.id,
        answers=reflection.answers,
        pattern_tags=reflection.pattern_tags
    )
    db.add(db_reflection)
    
    # Update Growth Tree logic (simplified for MVP)
    tree = db.query(models.GrowthTree).filter(models.GrowthTree.user_id == current_user.id).first()
    if tree:
        tree.leaf_density += 1
        if tree.leaf_density > 5:
            tree.leaf_density = 1
            tree.branch_level += 1
            
    db.commit()
    db.refresh(db_reflection)
    return db_reflection

@app.post("/api/generate-loop-tasks")
async def generate_loop_tasks(payload: dict):
    # This endpoint receives the context and chooses tasks.
    # In a real app, this would call Claude/GPT.
    # Here, we return a smart selection based on the context rules.
    
    context = payload.get("context", {})
    recent_titles = context.get("recentTitles", [])
    moods = context.get("moods", [])
    completion_rate = context.get("completionRate", 50)
    
    # Simple rule-based generation to mimic AI for now
    # (The frontend already handles fallback, but this gives the 'backend AI' feel)
    
    # Rule: If mood is heavy, keep it light
    is_low_energy = any(m in ["heavy", "drained"] for m in moods)
    
    # Rule: Diversity
    categories = ["focus", "discipline", "emotional-reset", "reflection", "health", "sleep", "meaning", "awareness", "action", "connection"]
    random.shuffle(categories)
    
    # Sample data mapping categories to cinematic titles and descriptions
    CINEMATIC_DATA = {
        "focus": {
            "title": "Misty Forest Focus",
            "desc": "Before the world pours in, find stillness in the misty forest of your mind.",
            "why": "Deep focus activates the brain's saliency network, allowing you to filter out noise and prioritize what truly matters."
        },
        "discipline": {
            "title": "Dawn Breaking Commitment",
            "desc": "Like the sun rising over the ridge, your discipline is a reliable force.",
            "why": "Discipline is the bridge between goals and accomplishment. Small acts of commitment rewire your brain for long-term reward."
        },
        "awareness": {
            "title": "Rain on Leaves presence",
            "desc": "Notice the details. The world is rich with information if you stop to look.",
            "why": "Mindful awareness reduces the size of the amygdala and increases gray matter in the prefrontal cortex."
        },
        "reflection": {
            "title": "Lantern on the Water",
            "desc": "Close the day by reflecting on the light you found in the darkness.",
            "why": "Refining your experiences through reflection turns raw events into wisdom and emotional resilience."
        },
        "health": {
            "title": "Vitality in the clearing",
            "desc": "Move your body to clear your mind. Strength starts with a single stretch.",
            "why": "Physical movement releases BDNF, a protein that acts as fertilizer for your brain cells."
        }
    }
    
    tasks = []
    # 3 Core Tasks
    selected_cats = categories[:3]
    for i, cat in enumerate(selected_cats):
        cin = CINEMATIC_DATA.get(cat, CINEMATIC_DATA["awareness"])
        tasks.append({
            "title": f"{cat.capitalize()} Session",
            "subtitle": f"10 minutes of {cat}.",
            "category": cat,
            "detail_title": cin["title"],
            "detail_description": cin["desc"],
            "why": cin["why"],
            "inline_quote": "The path is made by walking it." if i == 0 else None,
            "duration_minutes": 10 if is_low_energy else 20,
            "preferred_time": "morning" if i == 0 else "afternoon",
            "intensity": "light" if is_low_energy else "medium",
        })
        
    # 1 Optional Task
    cin = CINEMATIC_DATA["reflection"]
    tasks.append({
        "title": "Daily Integration",
        "subtitle": "An optional space for your mind.",
        "category": "reflection",
        "detail_title": cin["title"],
        "detail_description": cin["desc"],
        "why": cin["why"],
        "inline_quote": None,
        "duration_minutes": 15,
        "preferred_time": "evening",
        "intensity": "medium",
    })
    
    return tasks
