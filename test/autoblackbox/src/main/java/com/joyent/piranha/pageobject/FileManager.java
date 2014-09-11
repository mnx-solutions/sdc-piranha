package com.joyent.piranha.pageobject;

import com.joyent.piranha.PropertyHolder;
import org.openqa.selenium.By;

import java.io.IOException;

import static com.codeborne.selenide.Condition.exist;
import static com.codeborne.selenide.Condition.visible;
import static com.codeborne.selenide.Configuration.timeout;
import static com.codeborne.selenide.Selectors.byText;
import static com.codeborne.selenide.Selenide.$;
import static com.codeborne.selenide.Selenide.sleep;

public class FileManager extends AbstractPageObject {
    String getTitle() {
        return "File Manager";
    }

    public void waitForMediumSpinnerDisappear() {
        $("[data-ng-repeat=\"files in filesTree\"] .loading-medium-transparent").waitWhile(visible, timeout);
    }

    public void uploadTestFile(String userName, String testFolderName) throws IOException {
        String path = testFolderName.equals("") ? "" : testFolderName + "/";
        ProcessBuilder processBuilder = new ProcessBuilder("mput", "-f", PropertyHolder.getPublicKeyPath(), "/" + userName + "/public/" + path);
        processBuilder.environment().put("MANTA_USER", userName);
        processBuilder.environment().put("MANTA_KEY_ID", PropertyHolder.getPublicKeyID());
        processBuilder.environment().put("MANTA_URL", PropertyHolder.getMantaUrl());
        processBuilder.environment().put("MANTA_TLS_INSECURE", "1");
        processBuilder.start();
        //wait for server
        sleep(5000);
    }

    public void selectFolder(String folder) {
        while (true) {
            sleep(500);
            $(byText(folder)).click();
            if ($(By.xpath("//div[@data-ng-repeat=\"path in files\" and contains(.,'" + folder + "')]")).attr("class").contains("active")) {
                break;
            }
        }
        $("[data-ng-repeat=\"files in filesTree\"] div.column-files").waitWhile(exist, timeout);
    }

    public void createNewFolder(String folderName) {
        $("button[data-ng-click=\"createFolder()\"]").click();
        setValue($("#folderName"), folderName);
        clickButtonInModal("Ok");
    }

    public void clickDelete() {
        $("[data-ng-click=\"deleteFile()\"]").click();
    }

    public void waitForPageLoading() {
        $(".general-column.column-folders").waitWhile(exist, timeout);
    }

    public void clickDownload() {
        $("[data-ng-click=\"downloadFile()\"]").click();
    }

    public void clickGetInfo() {
        $("[data-ng-click=\"getInfo()\"]").click();
    }
}
