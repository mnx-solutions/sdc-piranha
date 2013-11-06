package data;

public class Package {
	private String name;
	private String displayedName;
	private String memory;
	private String disk;
	private String swap;
	private String vcpus;
	private String id;
	private String version;
	private String description;
	private String group;
	private String price;
	private String priceMonth;

	public Package(String name, String displayedName, String memory,
			String disk, String swap, String vcpus, String id, String version,
			String description, String group, String price, String priceMonth) {
		this.name = name;
		this.displayedName = displayedName;
		this.memory = memory;
		this.disk = disk;
		this.swap = swap;
		this.vcpus = vcpus;
		this.id = id;
		this.version = version;
		this.description = description;
		this.group = group;
		this.price = price;
		this.priceMonth = priceMonth;
	}

	@Override
	public String toString() {
		return "Package [name=" + name + ", memory=" + memory + ", disk="
				+ disk + ", swap=" + swap + ", vcpus=" + vcpus + ", id=" + id
				+ ", version=" + version + ", description=" + description
				+ ", group=" + group + "]";
	}

	public String getName() {
		return name;
	}

	public void setName(String name) {
		this.name = name;
	}

	public String getMemory() {
		return memory;
	}

	public void setMemory(String memory) {
		this.memory = memory;
	}

	public String getDisk() {
		return disk;
	}

	public void setDisk(String disk) {
		this.disk = disk;
	}

	public String getSwap() {
		return swap;
	}

	public void setSwap(String swap) {
		this.swap = swap;
	}

	public String getVcpus() {
		return vcpus;
	}

	public void setVcpus(String vcpus) {
		this.vcpus = vcpus;
	}

	public String getId() {
		return id;
	}

	public void setId(String id) {
		this.id = id;
	}

	public String getVersion() {
		return version;
	}

	public void setVersion(String version) {
		this.version = version;
	}

	public String getDescription() {
		return description;
	}

	public void setDescription(String description) {
		this.description = description;
	}

	public String getGroup() {
		return group;
	}

	public void setGroup(String group) {
		this.group = group;
	}

	public String getPrice() {
		return price;
	}

	public void setPrice(String price) {
		this.price = price;
	}

	public String getPriceMonth() {
		return priceMonth;
	}

	public void setPriceMonth(String priceMonth) {
		this.priceMonth = priceMonth;
	}

	public String getDisplayedName() {
		return displayedName;
	}

	public void setDisplayedName(String displayedName) {
		this.displayedName = displayedName;
	}

}
