package data;

public class Image {
	private String id;
	private String name;
	private String version;
	private String os;
	private String type;
	private String description;
	private String urn;
	private Requirements requirements;
	private Tags tags;

	public Image(String id, String name, String version, String os,
			String type, String description, String urn,
			Requirements requirements, Tags tags) {
		super();
		this.id = id;
		this.name = name;
		this.version = version;
		this.os = os;
		this.type = type;
		this.description = description;
		this.urn = urn;
		this.requirements = requirements;
		this.tags = tags;
	}

	@Override
	public String toString() {
		return "Image [id=" + id + ", name=" + name + ", version=" + version
				+ ", os=" + os + ", type=" + type + ", description="
				+ description + ", urn=" + urn + ", requirements="
				+ requirements + ", tags=" + tags + "]";
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getVersion() {
		return version;
	}

	public void setVersion(String version) {
		this.version = version;
	}

	public String getOs() {
		return os;
	}

	public void setOs(String os) {
		this.os = os;
	}

	public String getType() {
		return type;
	}

	public void setType(String type) {
		this.type = type;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getUrn() {
		return urn;
	}

	public void setUrn(String urn) {
		this.urn = urn;
	}

	public Requirements getRequirements() {
		return requirements;
	}

	public void setRequirements(Requirements requirements) {
		this.requirements = requirements;
	}

	public Tags getTags() {
		return tags;
	}

	public void setTags(Tags tags) {
		this.tags = tags;
	}
}
