from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    voc_records = relationship("VocRecord", back_populates="owner")
    reports = relationship("Report", back_populates="owner")


class VocRecord(Base):
    __tablename__ = "voc_records"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    external_id = Column(String, nullable=True)
    created_at = Column(DateTime, nullable=True)
    source_type = Column(String, nullable=False)  # review / inquiry / complaint
    product_name = Column(String, nullable=True)
    branch_name = Column(String, nullable=True)
    customer_text = Column(Text, nullable=False)
    rating = Column(Float, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="voc_records")
    analysis = relationship("VocAnalysis", back_populates="voc_record", uselist=False)


class VocAnalysis(Base):
    __tablename__ = "voc_analyses"

    id = Column(Integer, primary_key=True, index=True)
    voc_record_id = Column(Integer, ForeignKey("voc_records.id"), nullable=False)
    category = Column(String, nullable=False)
    sentiment = Column(String, nullable=False)  # positive / neutral / negative
    keywords = Column(JSON, nullable=False, default=list)
    priority_score = Column(String, nullable=False)  # low / medium / high
    analyzed_at = Column(DateTime, default=datetime.utcnow)

    voc_record = relationship("VocRecord", back_populates="analysis")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    summary = Column(JSON, nullable=False, default=dict)
    top_issues = Column(JSON, nullable=False, default=list)
    rising_keywords = Column(JSON, nullable=False, default=list)
    improvement_suggestions = Column(JSON, nullable=False, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="reports")
