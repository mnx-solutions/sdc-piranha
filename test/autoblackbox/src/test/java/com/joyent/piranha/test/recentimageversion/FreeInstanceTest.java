package com.joyent.piranha.test.recentimageversion;

import com.codeborne.selenide.SelenideElement;
import com.codeborne.selenide.WebDriverRunner;
import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.Session;
import com.joyent.piranha.Common;
import com.joyent.piranha.PropertyHolder;
import com.joyent.piranha.pageobject.*;
import com.joyent.piranha.pageobject.instancedetails.InstanceDetails;
import com.joyent.piranha.util.TestWrapper;
import com.joyent.piranha.utils.InstanceParser;
import org.apache.commons.io.IOUtils;
import org.json.JSONObject;
import org.junit.*;
import org.junit.runner.RunWith;
import org.junit.runners.Parameterized;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.support.ui.ExpectedCondition;
import org.openqa.selenium.support.ui.Wait;
import org.openqa.selenium.support.ui.WebDriverWait;

import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Properties;

import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.baseUrl;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selenide.*;
import static junit.framework.Assert.assertTrue;

@RunWith(Parameterized.class)
public class FreeInstanceTest extends TestWrapper {
    public static final String USER_NAME = PropertyHolder.getTestUserLogin();
    public static final String PASSWORD = PropertyHolder.getTestUserPassword();
    public static final String ROW_SELECTOR = "[data-ng-repeat=\"object in pagedItems\"]";
    private static NavBarMenu navBarMenu;
    private static SideBarMenu sideBarMenu;
    private static Instances instances;
    private static InstanceVO instance;
    private String dataset;

    public FreeInstanceTest(CreateInstance createInstance, InstanceVO instance) throws FileNotFoundException {
        FreeInstanceTest.instance = instance;
        sideBarMenu.clickCompute();
        if ($("thead").exists()) {
            InstanceList instanceList = page(InstanceList.class);
            instanceList.deleteInstance(instanceList.getFirstInstanceName());
        }
        sideBarMenu.clickDashboard().clickCreateComputeInstance();
        Instances instances = createInstance.createInstance(instance);
        instances.waitForInstanceRunning();
        instance.setName(page(InstanceList.class).getFirstInstanceName());
    }

    @BeforeClass
    public static void openDashboard() {
        timeout = BASE_TIMEOUT;
        baseUrl = BASE_URL;

        Login loginPage = open("/", Login.class);
        loginPage.login(USER_NAME, PASSWORD);
        page(Dashboard.class).getFreeTierWidget().waitUntil(visible, timeout);
        navBarMenu = page(NavBarMenu.class);
        sideBarMenu = page(SideBarMenu.class);
        instances = page(Instances.class);
    }

    @Parameterized.Parameters
    public static Collection<Object> parametrize() throws FileNotFoundException {
        Collection<Object> createInstances = new ArrayList<>();
        List<InstanceVO> instanceVOList = InstanceParser.getInstance(PropertyHolder.getDatacenter(0));
        for (InstanceVO instanceVO : instanceVOList) {
            if (instanceVO.isManual()) {
                createInstances.add(new Object[]{new CreateInstanceManual(), instanceVO});
            }
            if (instanceVO.isFree()) {
                createInstances.add(new Object[]{new CreateInstanceQuickStart(true), instanceVO});
            }
            if (instanceVO.isPaid()) {
                createInstances.add(new Object[]{new CreateInstanceQuickStart(false), instanceVO});
            }
        }
        return createInstances;
    }

    @AfterClass
    public static void endClass() {
        InstanceList instanceList = sideBarMenu.clickCompute().getInstanceList();
        instanceList.deleteInstance(instance.getName());
        navBarMenu.clickAccountMenu().clickLogout();
    }

    @After
    public void logout() {
        sideBarMenu.errorNotPresent();
    }

    @Before
    public void openComputePage() {
        sideBarMenu.clickCompute();
        dataset = concatNameAndVersion(":");
    }

    @Test
    public void checkIfImageDataIsCorrect() throws Exception {
//    check data in instance grid
        waitForCondition(concatNameAndVersion("/"));
        instances.addGridColumn("Image ID");
        instances.addGridColumn("Dataset");
        final SelenideElement row = $(ROW_SELECTOR);
        String imageId = Common.getImageID(instance.getImageName(), instance.getDatacenter(), instance.getVersion());
        waitForCondition(dataset);
        assertTrue(row.text().contains(imageId));

//    check data in instance details
        sideBarMenu.clickCompute();
        InstanceDetails instanceDetails = instances.getInstanceList().openFirstInstanceDetails();
        instanceDetails.checkTitle();
        instanceDetails.getImageUUID();
        instanceDetails.getImageName();
        instanceDetails.gitImageVersion();

//    check data from sdc
        sideBarMenu.clickCompute();
        instanceDetails = instances.getInstanceList().openFirstInstanceDetails();
        instanceDetails.getInstanceId();
        JSONObject machineInfo = Common.getMachineInfo(instanceDetails.getInstanceId());
        assertTrue(machineInfo.get("image").equals(instanceDetails.getImageUUID()));
        assertTrue(machineInfo.get("dataset").toString().contains(dataset));

//    verify Motd data
        sideBarMenu.clickCompute();
        instanceDetails = instances.getInstanceList().openFirstInstanceDetails();
        JSch jSch = new JSch();

        byte[] key = IOUtils.toByteArray(new FileInputStream(PropertyHolder.getPrivateKeyPath()));
        jSch.addIdentity("root", key, null, new byte[0]);
        String host = instanceDetails.getInstanceIP();
        Session session = jSch.getSession("root", host);
        Properties config = new Properties();

        config.put("UserKnownHostsFile", "/dev/null");
        config.put("StrictHostKeyChecking", "no");
        session.setConfig(config);
        session.connect();
        ChannelShell channel = (ChannelShell) session.openChannel("shell");
        InputStream in = channel.getInputStream();
        channel.connect();
        StringBuilder stdOutBuilder = new StringBuilder();
        while (true) {
            stdOutBuilder.append(readOut(in));
            if (stdOutBuilder.length() > 0) {
                channel.disconnect();
                session.disconnect();
                break;
            }
            Thread.sleep(1000);
        }
        session.disconnect();
        assertTrue(stdOutBuilder.toString().contains(concatNameAndVersion(" ")));
    }

    private StringBuilder readOut(InputStream in) throws IOException {
        StringBuilder stdOutBuilder = new StringBuilder();
        byte[] tmp = new byte[1024];
        while (in.available() > 0) {
            int i = in.read(tmp, 0, 1024);
            if (i < 0) {
                break;
            }

            String str = new String(tmp, 0, i);
            stdOutBuilder.append(str);
        }
        return stdOutBuilder;
    }

    private String concatNameAndVersion(String separator) {
        return instance.getImageName() + separator + instance.getVersion();
    }

    private void waitForCondition(final String condition) {
        Wait<WebDriver> wait = new WebDriverWait(WebDriverRunner.getWebDriver(), 30);
        wait.until(new ExpectedCondition<Boolean>() {
            @Override
            public Boolean apply(WebDriver input) {
                final SelenideElement row = $(ROW_SELECTOR);
                return row.text().contains(condition);
            }
        });
    }
}
