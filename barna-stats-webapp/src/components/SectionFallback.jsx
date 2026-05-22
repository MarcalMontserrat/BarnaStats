import appStyles from "../styles/appStyles.js";

function SectionFallback({message}) {
    return (
        <div style={appStyles.loadingCard}>
            {message}
        </div>
    );
}

export default SectionFallback;
