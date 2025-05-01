#!/usr/bin/env python3  
"""  
API server for Lu.ma Event Ratings Chrome Extension  
Uses pgAI for vector embeddings and TimescaleDB for storage  
"""  
  
import json  
import os  
import uuid  
from datetime import datetime  
from typing import Dict, List, Optional, Tuple, Union  
  
import numpy as np  
import pandas as pd  
import pgvector  
import uvicorn  
from dotenv import load_dotenv  
from fastapi import FastAPI, HTTPException, Request  
from fastapi.middleware.cors import CORSMiddleware  
from pgai.vectorizer.embedders.openai import OpenAI  # Fixed import  
from pydantic import BaseModel  
from sqlalchemy import Column, DateTime, Integer, MetaData, String, Table, create_engine, text  
from sqlalchemy.dialects.postgresql import BYTEA, JSON, UUID  
from sqlalchemy.ext.declarative import declarative_base  
from sqlalchemy.orm import sessionmaker  
  
# Load environment variables from .env file  
load_dotenv(".env")  
  
# Initialize FastAPI app  
app = FastAPI(title="Lu.ma Event Rating API")  
  
# Add CORS middleware  
app.add_middleware(  
    CORSMiddleware,  
    allow_origins=["*"],  # For production, restrict to your extension's origin  
    allow_credentials=True,  
    allow_methods=["*"],  
    allow_headers=["*"],  
)  
  
# Database connection  
TIMESCALE_SERVICE_URL = os.environ["TIMESCALE_SERVICE_URL"]
if TIMESCALE_SERVICE_URL.startswith('postgres://'):
    TIMESCALE_SERVICE_URL = TIMESCALE_SERVICE_URL.replace('postgres://', 'postgresql://', 1)
engine = create_engine(TIMESCALE_SERVICE_URL)  
Session = sessionmaker(bind=engine)  
Base = declarative_base()  
metadata = MetaData()  
  
# Initialize pgAI embedder for embeddings  
embedder = OpenAI(  
    implementation="openai",
    model="text-embedding-3-small",  
    dimensions=1536  
)  
  
# Models  
class Event(BaseModel):  
    eventId: str  
    eventTitle: Optional[str] = None  
    url: Optional[str] = None  
    description: Optional[str] = None  
      
class EventRating(BaseModel):  
    rating: float  
    explanation: str  
      
class UserInterest(BaseModel):  
    interests: List[str]  
      
# Create tables in TimescaleDB  
events_table = Table(  
    "events",  
    metadata,  
    Column("id", UUID, primary_key=True),  
    Column("event_id", String, nullable=False, index=True),  
    Column("title", String),  
    Column("url", String),  
    Column("description", String),  
    Column("embedding", BYTEA),  
    Column("created_at", DateTime, default=datetime.utcnow),  
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),  
)  
  
user_interests_table = Table(  
    "user_interests",  
    metadata,  
    Column("id", UUID, primary_key=True),  
    Column("user_id", String, nullable=False),  
    Column("interests", JSON),  
    Column("embedding", BYTEA),  
    Column("created_at", DateTime, default=datetime.utcnow),  
    Column("updated_at", DateTime, default=datetime.utcnow, onupdate=datetime.utcnow),  
)  
  
ratings_table = Table(  
    "ratings",  
    metadata,  
    Column("id", UUID, primary_key=True),  
    Column("event_id", String, nullable=False),  
    Column("user_id", String, nullable=False),  
    Column("rating", Integer),  
    Column("explanation", String),  
    Column("created_at", DateTime, default=datetime.utcnow),  
)  
  
# Create tables if they don't exist  
def setup_database():  
    try:  
        metadata.create_all(engine)  
        print("Database tables created successfully")  
          
        # Enable pgvector extension if not already enabled  
        with engine.connect() as conn:  
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))  
            print("Vector extension enabled")  
    except Exception as e:  
        print(f"Error setting up database: {e}")  
  
# Helper Functions  
async def compute_event_embedding(event: Event) -> np.ndarray:  
    """Generate embeddings for event data using pgAI"""  
    text = f"{event.eventTitle or ''} {event.description or ''}"  
    if not text.strip():  
        return np.zeros(1536)  # Default embedding size for pgAI  
      
    try:  
        embedding_result = await embedder.embed([text])  
        return embedding_result[0]  
    except Exception as e:  
        print(f"Error generating embedding: {e}")  
        return np.zeros(1536)  # Return zero vector on error  
  
async def compute_user_embedding(interests: List[str]) -> np.ndarray:  
    """Generate embeddings for user interests using pgAI"""  
    text = " ".join(interests)  
    try:  
        embedding_result = await embedder.embed([text])  
        return embedding_result[0]  
    except Exception as e:  
        print(f"Error generating embedding: {e}")  
        return np.zeros(1536)  # Return zero vector on error  
  
def calculate_similarity(vec1: np.ndarray, vec2: np.ndarray) -> float:  
    """Calculate cosine similarity between two vectors"""  
    dot_product = np.dot(vec1, vec2)  
    norm_a = np.linalg.norm(vec1)  
    norm_b = np.linalg.norm(vec2)  
      
    if norm_a == 0 or norm_b == 0:  
        return 0  
      
    return dot_product / (norm_a * norm_b)  
  
def calculate_rating(similarity: float) -> Tuple[float, str]:  
    """Convert similarity score to a 0-10 rating scale with explanation"""  
    # Scale from cosine similarity (-1 to 1) to rating (0 to 10)  
    # Typically similarity scores are in range 0 to 1 for text embeddings  
    rating = min(10, max(0, (similarity * 5) + 5))  
      
    if rating >= 8:  
        explanation = "This event strongly matches your interests."  
    elif rating >= 6:  
        explanation = "This event moderately matches your interests."  
    elif rating >= 4:  
        explanation = "This event somewhat matches your interests."  
    else:  
        explanation = "This event doesn't closely match your interests."  
          
    return rating, explanation  
  
def serialize_embedding(embedding: np.ndarray) -> bytes:  
    """Serialize embedding for storage in database"""  
    return pgvector.to_bytes(embedding)  
  
def deserialize_embedding(embedding_bytes: bytes) -> np.ndarray:  
    """Deserialize embedding from database storage"""  
    return pgvector.from_bytes(embedding_bytes)  
  
# API Endpoints  
@app.get("/")  
async def root():  
    return {"message": "Lu.ma Event Rating API is running"}  
  
@app.post("/api/event-rating")  
async def get_event_rating(event: Event, request: Request):  
    """Get personalized rating for an event"""  
    # For now, use a mock user ID (in production, would come from auth)  
    user_id = "mock_user_id"  
      
    session = Session()  
    try:  
        # Check if event exists in database, create if it doesn't  
        db_event = session.query(events_table).filter(  
            events_table.c.event_id == event.eventId  
        ).first()  
          
        if not db_event:  
            # Compute embedding for new event  
            event_embedding = await compute_event_embedding(event)  
            event_embedding_bytes = serialize_embedding(event_embedding)  
              
            # Create new event record  
            new_event = {  
                "id": uuid.uuid4(),  
                "event_id": event.eventId,  
                "title": event.eventTitle,  
                "url": event.url,  
                "description": event.description,  
                "embedding": event_embedding_bytes,  
                "created_at": datetime.utcnow(),  
                "updated_at": datetime.utcnow(),  
            }  
            session.execute(events_table.insert().values(**new_event))  
            session.commit()  
              
            event_embedding_obj = event_embedding  
        else:  
            # Use existing embedding  
            event_embedding_obj = deserialize_embedding(db_event.embedding)  
          
        # Get or create user interests  
        user_interests = session.query(user_interests_table).filter(  
            user_interests_table.c.user_id == user_id  
        ).first()  
          
        if not user_interests:  
            # Create default user interests for demonstration  
            default_interests = ["technology", "artificial intelligence", "data science"]  
            user_embedding = await compute_user_embedding(default_interests)  
            user_embedding_bytes = serialize_embedding(user_embedding)  
              
            new_user_interest = {  
                "id": uuid.uuid4(),  
                "user_id": user_id,  
                "interests": json.dumps(default_interests),  
                "embedding": user_embedding_bytes,  
                "created_at": datetime.utcnow(),  
                "updated_at": datetime.utcnow(),  
            }  
            session.execute(user_interests_table.insert().values(**new_user_interest))  
            session.commit()  
              
            user_embedding_obj = user_embedding  
        else:  
            # Use existing embedding  
            user_embedding_obj = deserialize_embedding(user_interests.embedding)  
          
        # Calculate similarity and rating  
        similarity = calculate_similarity(event_embedding_obj, user_embedding_obj)  
        rating, explanation = calculate_rating(similarity)  
          
        # Store rating  
        new_rating = {  
            "id": uuid.uuid4(),  
            "event_id": event.eventId,  
            "user_id": user_id,  
            "rating": round(rating),  
            "explanation": explanation,  
            "created_at": datetime.utcnow(),  
        }  
        session.execute(ratings_table.insert().values(**new_rating))  
        session.commit()  
          
        # Return rating to client  
        return EventRating(rating=rating, explanation=explanation)  
      
    except Exception as e:  
        session.rollback()  
        raise HTTPException(status_code=500, detail=f"Error processing event rating: {str(e)}")  
      
    finally:  
        session.close()  
  
@app.post("/api/update-user-interests")  
async def update_user_interests(user_interest: UserInterest, request: Request):  
    """Update user interests"""  
    # For now, use a mock user ID (in production, would come from auth)  
    user_id = "mock_user_id"  
      
    session = Session()  
    try:  
        # Compute embedding for user interests  
        user_embedding = await compute_user_embedding(user_interest.interests)  
        user_embedding_bytes = serialize_embedding(user_embedding)  
          
        # Check if user exists  
        existing_user = session.query(user_interests_table).filter(  
            user_interests_table.c.user_id == user_id  
        ).first()  
          
        if existing_user:  
            # Update existing user interests  
            session.execute(  
                user_interests_table.update()  
                .where(user_interests_table.c.user_id == user_id)  
                .values(  
                    interests=json.dumps(user_interest.interests),  
                    embedding=user_embedding_bytes,  
                    updated_at=datetime.utcnow(),  
                )  
            )  
        else:  
            # Create new user interests  
            new_user_interest = {  
                "id": uuid.uuid4(),  
                "user_id": user_id,  
                "interests": json.dumps(user_interest.interests),  
                "embedding": user_embedding_bytes,  
                "created_at": datetime.utcnow(),  
                "updated_at": datetime.utcnow(),  
            }  
            session.execute(user_interests_table.insert().values(**new_user_interest))  
          
        session.commit()  
        return {"status": "success", "message": "User interests updated"}  
      
    except Exception as e:  
        session.rollback()  
        raise HTTPException(status_code=500, detail=f"Error updating user interests: {str(e)}")  
      
    finally:  
        session.close()  
  
@app.get("/api/trending-events")  
async def get_trending_events():  
    """Get trending events with highest average ratings"""  
    session = Session()  
    try:  
        # Query for events with highest ratings  
        query = """  
        SELECT   
            e.event_id,   
            e.title,  
            e.url,  
            AVG(r.rating) as avg_rating,  
            COUNT(r.id) as rating_count  
        FROM   
            events e  
        JOIN   
            ratings r ON e.event_id = r.event_id  
        GROUP BY   
            e.event_id, e.title, e.url  
        ORDER BY   
            avg_rating DESC, rating_count DESC  
        LIMIT 10  
        """  
          
        # Fix: Use text() for raw SQL execution  
        result = session.execute(text(query))  
        trending_events = [  
            {  
                "eventId": row[0],  
                "title": row[1],  
                "url": row[2],  
                "avgRating": float(row[3]),  
                "ratingCount": row[4]  
            }  
            for row in result  
        ]  
          
        return {"trendingEvents": trending_events}  
      
    except Exception as e:  
        raise HTTPException(status_code=500, detail=f"Error fetching trending events: {str(e)}")  
      
    finally:  
        session.close()  
  
# Initialize database and embedder on startup  
@app.on_event("startup")  
async def startup():  
    # Set up OpenAI API key from environment  
    if "OPENAI_API_KEY" not in os.environ:  
        print("Warning: OPENAI_API_KEY environment variable not set")  
        # You might want to load from .env file or other secure source  
        # os.environ["OPENAI_API_KEY"] = "your-api-key"  
      
    # Set up database  
    setup_database()  
      
    # Set up embedder  
    try:  
        await embedder.setup()  
        print("Embedder set up successfully")  
    except Exception as e:  
        print(f"Error setting up embedder: {e}")  
  
# Run server  
if __name__ == "__main__":  
    uvicorn.run("api:app", host="0.0.0.0", port=8000, reload=True)