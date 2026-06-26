import streamlit as st

st.set_page_config(page_title="Commander Lab", layout="wide")

st.title("Commander Lab v0.1")

uploaded = st.file_uploader("Upload Commander deck (.txt)", type=["txt"])

target = st.selectbox("Target Turn",[4,5,6,7], index=1)
playstyle = st.selectbox("Playstyle",["Battlecruiser","Balanced","Fast Combo"])

if uploaded:
    deck = uploaded.read().decode("utf-8")
    lines = [l.strip() for l in deck.splitlines() if l.strip()]
    st.success(f"Loaded {len(lines)} lines")
    st.subheader("Deck Preview")
    st.code("\n".join(lines[:15]))

st.info("Analysis engine coming next milestone.")
